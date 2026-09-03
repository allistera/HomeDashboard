import { defineComponent, type PropType } from "vue";

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
  },
  setup(props) {
    return () => (
      <div class="events">
        {props.events.length === 0 && (
          <div class="event event--empty">
            <span class="event__text">{props.emptyMessage}</span>
          </div>
        )}
        {props.events.map((event) => (
          <div key={`${event.time}-${event.text}`} class="event">
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
