import { defineComponent, type PropType } from "vue";
import type { DeviceProperty, RoomDevice } from "@/models/rooms";

function propertyValue(property: DeviceProperty): string {
  if (property.value === null) return "Unknown";
  if (property.value === true) return "Yes";
  if (property.value === false) return "No";
  if (property.value === "") return "Empty";
  return `${property.value}${property.units ? ` ${property.units}` : ""}`;
}

export default defineComponent({
  name: "RoomDeviceDetails",
  props: {
    // SAFETY: RoomsPage supplies the typed RoomDevice model to this object prop.
    device: { type: Object as PropType<RoomDevice>, required: true },
  },
  setup(props) {
    return () => (
      <details class="device-details">
        <summary class={["row", { "row--dim": !props.device.available }]}>
          <div>
            <span class="row__name">{props.device.name}</span>
            <div class="row__meta">{props.device.type.replace(/_/g, " ")}</div>
          </div>
          <span class="row__meta">{props.device.available ? "AVAILABLE" : "OFFLINE"}</span>
          <span class="device-details__arrow" aria-hidden="true">
            ›
          </span>
        </summary>
        <div class="device-details__body">
          {!props.device.available && <p class="row__meta">Offline · last known values</p>}
          <dl class="device-properties">
            <div class="device-properties__item">
              <dt>Device ID</dt>
              <dd>{props.device.id}</dd>
            </div>
            {(props.device.properties ?? []).map((property) => (
              <div class="device-properties__item" key={property.id}>
                <dt title={property.id}>{property.name}</dt>
                <dd>{propertyValue(property)}</dd>
              </div>
            ))}
          </dl>
          {!props.device.properties?.length && (
            <p class="row__meta">No properties reported by Homey.</p>
          )}
        </div>
      </details>
    );
  },
});
