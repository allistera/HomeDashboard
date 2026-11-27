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

      if (player.canPlayType("application/vnd.apple.mpegurl")) {
        player.src = hlsUrl;
        player.addEventListener("error", onError);
        onCleanup(() => {
          player.removeEventListener("error", onError);
          player.removeAttribute("src");
          player.load();
        });
        play();
        return;
      }

      let cancelled = false;
      let destroy: (() => void) | undefined;
      onCleanup(() => {
        cancelled = true;
        destroy?.();
      });
      void import("hls.js")
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            onError();
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
