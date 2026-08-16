import { defineComponent } from "vue";

export default defineComponent({
  name: "CameraTile",
  props: {
    name: { type: String, required: true },
    live: { type: Boolean, default: false },
    note: { type: String, default: "" },
    height: { type: Number, default: 126 },
  },
  setup(props) {
    return () => (
      <div class="camera" style={{ height: `${props.height}px` }}>
        <span class="camera__tag">{props.name}</span>
        {props.live && <span class="camera__tag camera__tag--live">LIVE</span>}
        {props.note && <span class="camera__tag">{props.note}</span>}
      </div>
    );
  },
});
