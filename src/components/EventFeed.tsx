import { defineComponent, type PropType } from "vue";

export interface FeedEvent {
  time: string;
  text: string;
  accent?: boolean;
}

export default defineComponent({
  name: "EventFeed",
  props: {
    events: { type: Array as PropType<FeedEvent[]>, required: true },
  },
  setup(props) {
    return () => (
      <div class="events">
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
