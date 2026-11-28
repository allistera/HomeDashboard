import { watch, type Ref } from "vue";

export function useCameraVideo(
  video: Ref<HTMLVideoElement | null>,
  getStream: () => MediaStream | null,
  getHlsUrl: () => string,
  onError: () => void,
): void {
  watch(
    [video, getStream, getHlsUrl],
    ([player, stream, hlsUrl], _, onCleanup) => {
      if (!player) return;
      const play = () => void player.play().catch(() => undefined);

      if (stream) {
        player.srcObject = stream;
        onCleanup(() => {
          player.srcObject = null;
        });
        play();
        return;
      }
      if (!hlsUrl) return;
      const nativeSupport = player.canPlayType("application/vnd.apple.mpegurl");

      let cancelled = false;
      let destroy: (() => void) | undefined;
      onCleanup(() => {
        cancelled = true;
        destroy?.();
      });

      const playNative = () => {
        player.src = hlsUrl;
        player.addEventListener("error", onError);
        destroy = () => {
          player.removeEventListener("error", onError);
          player.removeAttribute("src");
          player.load();
        };
        play();
      };
      // Some browsers report "maybe" but fail to play Home Assistant's HLS natively.
      if (nativeSupport === "probably") {
        playNative();
        return;
      }

      void import("hls.js")
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            if (nativeSupport) playNative();
            else onError();
            return;
          }
          const hls = new Hls({ enableWorker: false, backBufferLength: 30 });
          destroy = () => hls.destroy();
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (!cancelled && data.fatal) onError();
          });
          hls.on(Hls.Events.MANIFEST_PARSED, play);
          hls.loadSource(hlsUrl);
          hls.attachMedia(player);
        })
        .catch(() => {
          if (!cancelled) onError();
        });
    },
    { flush: "post" },
  );
}
