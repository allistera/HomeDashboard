import { defineComponent, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";

export interface FeedEvent {
  time: string;
  text: string;
  accent?: boolean;
}

export default defineComponent({
  name: "EventFeed",
  props: {
    // SAFETY: `Array as PropType<T[]>` is Vue's documented pattern for typed array
    // props — the runtime validator stays `Array`, the cast only narrows the
    // compile-time element type.
    events: { type: Array as PropType<FeedEvent[]>, required: true },
    emptyMessage: { type: String, default: "No recent activity." },
    fit: { type: Boolean, default: false },
  },
  setup(props) {
    const list = ref<HTMLDivElement | null>(null);
    const visibleRows = ref(Infinity);
    let resizeObserver: ResizeObserver | undefined;

    const measureRows = () => {
      if (!props.fit || !list.value) return;
      const bottom = list.value.getBoundingClientRect().bottom;
      visibleRows.value = Array.from(list.value.children).filter(
        (row) => row.getBoundingClientRect().bottom <= bottom,
      ).length;
    };

    onMounted(() => {
      if (!props.fit || !list.value || !window.ResizeObserver) return;
      resizeObserver = new window.ResizeObserver(measureRows);
      resizeObserver.observe(list.value);
      measureRows();
    });
    onBeforeUnmount(() => resizeObserver?.disconnect());
    watch(() => props.events, measureRows, { flush: "post" });

    return () => (
      <div ref={list} class={["events", { "events--fit": props.fit }]}>
        {props.events.length === 0 && (
          <div class="event event--empty">
            <span class="event__text">{props.emptyMessage}</span>
          </div>
        )}
        {props.events.map((event, index) => (
          <div
            key={`${event.time}-${event.text}`}
            class={["event", { "event--overflow": props.fit && index >= visibleRows.value }]}
          >
            <span class="event__time">{event.time}</span>
            <span class={["event__text", { "event__text--accent": event.accent }]}>
              {event.text}
            </span>
          </div>
        ))}
      </div>
    );
  },
});
