import { defineComponent, onScopeDispose, ref, watch, type PropType } from "vue";

import { useCameraVideo } from "@/composables/useCameraVideo";
import { useDocumentVisible } from "@/composables/useDocumentVisible";

export type CameraTransport = "webrtc" | "hls";

function withCacheBust(url: string, bust: number): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}time=${bust}`;
}

export default defineComponent({
  name: "CameraTile",
  props: {
    name: { type: String, required: true },
    live: { type: Boolean, default: false },
    note: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    height: { type: Number, default: 126 },
    refreshMs: { type: Number, default: 8000 },
    videoPreview: { type: Boolean, default: false },
    // SAFETY: Vue validates the object shape and RoomCamera supplies the negotiated MediaStream.
    videoStream: { type: Object as PropType<MediaStream | null>, default: null },
    hlsUrl: { type: String, default: "" },
    // SAFETY: RoomCamera supplies only the negotiated transport or null during startup.
    activeTransport: { type: String as PropType<CameraTransport | null>, default: null },
  },
  emits: ["select", "playing", "waiting", "videoError"],
  setup(props, { emit }) {
    const streamFailed = ref(false);
    const webRtcVideo = ref<HTMLVideoElement | null>(null);
    const hlsVideo = ref<HTMLVideoElement | null>(null);
    const visible = useDocumentVisible();
    const bust = ref(Date.now());
    let timer: ReturnType<typeof setInterval> | undefined;

    const stopRefresh = () => {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
    };

    const startRefresh = () => {
      stopRefresh();
      if (props.refreshMs <= 0 || props.imageUrl === "") return;
      timer = setInterval(() => {
        if (visible.value) {
          streamFailed.value = false;
          bust.value = Date.now();
        }
      }, props.refreshMs);
    };

    watch(
      () => props.imageUrl,
      () => {
        streamFailed.value = false;
        bust.value = Date.now();
      },
    );

    watch(
      () => [props.imageUrl, props.refreshMs, visible.value, props.videoPreview] as const,
      ([, , isVisible, preview]) => {
        if (isVisible && !preview) {
          startRefresh();
        } else {
          stopRefresh();
        }
      },
      { immediate: true },
    );

    useCameraVideo(
      webRtcVideo,
      () => props.videoStream,
      () => "",
      () => emit("videoError", "webrtc"),
    );
    useCameraVideo(
      hlsVideo,
      () => null,
      () => props.hlsUrl,
      () => emit("videoError", "hls"),
    );

    const reportPlaying = (source: CameraTransport, player: HTMLVideoElement | null) => {
      if (
        player &&
        !player.paused &&
        player.videoWidth > 0 &&
        player.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        emit("playing", source);
      }
    };
    const reportWebRtcPlaying = () => reportPlaying("webrtc", webRtcVideo.value);
    const reportHlsPlaying = () => reportPlaying("hls", hlsVideo.value);

    watch([webRtcVideo, hlsVideo], ([rtc, hls], _, onCleanup) => {
      rtc?.addEventListener("resize", reportWebRtcPlaying);
      hls?.addEventListener("resize", reportHlsPlaying);
      onCleanup(() => {
        rtc?.removeEventListener("resize", reportWebRtcPlaying);
        hls?.removeEventListener("resize", reportHlsPlaying);
      });
    });

    onScopeDispose(stopRefresh);

    return () => {
      const url = props.imageUrl === "" ? "" : withCacheBust(props.imageUrl, bust.value);
      const showImage = !props.videoPreview && url !== "" && !streamFailed.value;
      const note = !props.videoPreview && streamFailed.value ? "STREAM UNAVAILABLE" : props.note;
      return (
        <button
          type="button"
          class="camera"
          style={{ height: `${props.height}px` }}
          aria-label={`Open ${props.name} camera in larger view`}
          aria-haspopup="dialog"
          onClick={() => emit("select")}
        >
          {props.videoPreview && (props.videoStream || !props.hlsUrl) && (
            <video
              class="camera__stream"
              ref={webRtcVideo}
              style={{ opacity: props.activeTransport === "webrtc" ? 1 : 0 }}
              autoplay
              muted
              playsinline
              aria-hidden="true"
              onPlaying={reportWebRtcPlaying}
              onLoadeddata={reportWebRtcPlaying}
              onWaiting={() => emit("waiting", "webrtc")}
              onError={() => emit("videoError", "webrtc")}
            />
          )}
          {props.videoPreview && props.hlsUrl && (
            <video
              class="camera__stream"
              ref={hlsVideo}
              style={{ opacity: props.activeTransport === "hls" ? 1 : 0 }}
              autoplay
              muted
              playsinline
              aria-hidden="true"
              onPlaying={reportHlsPlaying}
              onLoadeddata={reportHlsPlaying}
              onWaiting={() => emit("waiting", "hls")}
            />
          )}
          {showImage && (
            <img
              class="camera__stream"
              src={url}
              alt={`${props.name} camera`}
              decoding="async"
              referrerpolicy="no-referrer"
              onError={() => {
                streamFailed.value = true;
              }}
            />
          )}
          <span class="camera__tag">{props.name}</span>
          {props.live && (props.videoPreview || showImage) && (
            <span class="camera__tag camera__tag--live">LIVE</span>
          )}
          {note && <span class="camera__tag">{note}</span>}
        </button>
      );
    };
  },
});
