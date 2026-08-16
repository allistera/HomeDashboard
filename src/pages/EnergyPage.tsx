import { defineComponent } from "vue";

import TopBar from "@/components/TopBar";
import { useEnergyStore, type EnergyRange } from "@/stores/energy";

const ranges: { id: EnergyRange; name: string }[] = [
  { id: "day", name: "Day" },
  { id: "week", name: "Week" },
  { id: "month", name: "Month" },
  { id: "year", name: "Year" },
];

export default defineComponent({
  name: "EnergyPage",
  setup() {
    const energy = useEnergyStore();

    return () => (
      <main class="main">
        <TopBar
          left={["7:42 PM · THU", `TARIFF ${energy.tariff}`]}
          right={[`BILLING PERIOD DAY ${energy.billingDay} / ${energy.billingDays}`]}
          status={`DRAWING ${energy.liveDrawKw.toFixed(1)} KW`}
        />

        <div class="hero">
          <div>
            <div class="label">
              {energy.range === "day" ? "Today so far" : `This ${energy.range} so far`}
            </div>
            <h1 class="hero__title hero__title--xl">
              {energy.summary.usage}
              <span class="hero__title-unit"> · {energy.summary.cost}</span>
            </h1>
            <p class="hero__sub">{energy.summary.note}</p>
          </div>
          <div class="hero__actions">
            {ranges.map((range) => (
              <button
                type="button"
                key={range.id}
                class={["btn", "btn--small", { "btn--primary": energy.range === range.id }]}
                onClick={() => energy.setRange(range.id)}
              >
                {range.name}
              </button>
            ))}
          </div>
        </div>

        <div class="cols" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
          <div class="col">
            <div class="section-head">
              <span class="label">Last 24 hours · kW</span>
              <span class="label" style={{ letterSpacing: "normal" }}>
                {energy.peakNote}
              </span>
            </div>
            <div
              class="bars"
              style={{
                padding: "0 40px",
                gap: "5px",
                height: "210px",
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              {energy.hourly.map((height, index) => (
                <div
                  key={index}
                  class={[
                    "bars__bar",
                    {
                      "bars__bar--accent": index >= energy.hourly.length - energy.liveHoursFromEnd,
                    },
                  ]}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div class="bars-axis" style={{ padding: "8px 40px 0" }}>
              <span>00</span>
              <span>06</span>
              <span>12</span>
              <span>18</span>
              <span>NOW</span>
            </div>

            <div class="section-head" style={{ padding: "24px 40px 10px" }}>
              <span class="label">Using it now</span>
            </div>
            <div class="rows">
              {energy.usingNow.map((item) => (
                <div
                  key={item.name}
                  class="row"
                  style={{
                    gridTemplateColumns: "1fr 200px 76px",
                    gap: "20px",
                    padding: "14px 0",
                  }}
                >
                  <span class="row__name" style={{ fontSize: "19px" }}>
                    {item.name}
                  </span>
                  <div class="meter">
                    <div
                      class="meter__fill"
                      style={{ width: `${(item.kw / energy.maxDrawKw) * 82}%` }}
                    />
                  </div>
                  <span class="row__meta" style={{ textAlign: "right" }}>
                    {item.kw.toFixed(2)} kW
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div class="col">
            <div class="section-head" style={{ padding: "16px 36px 10px" }}>
              <span class="label">By room · Today</span>
            </div>
            <div class="rows" style={{ padding: "0 36px" }}>
              {energy.byRoom.map((room) => (
                <div
                  key={room.name}
                  class="row"
                  style={{ gridTemplateColumns: "1fr auto", padding: "13px 0" }}
                >
                  <span style={{ fontSize: "17px" }}>{room.name}</span>
                  <span class="row__meta" style={{ fontSize: "13px" }}>
                    {room.kwh.toFixed(1)} kWh
                  </span>
                </div>
              ))}
            </div>

            <div class="section-head" style={{ padding: "22px 36px 10px" }}>
              <span class="label">This week</span>
            </div>
            <div class="bars" style={{ padding: "0 36px", gap: "8px", height: "96px" }}>
              {energy.week.map((day, index) => (
                <div
                  key={index}
                  class={[
                    "bars__bar",
                    {
                      "bars__bar--accent": day.state === "today",
                      "bars__bar--dim": day.state === "future",
                    },
                  ]}
                  style={{ height: `${day.height}px`, alignSelf: "flex-end" }}
                />
              ))}
            </div>
            <div class="bars-axis" style={{ padding: "7px 36px 0", gap: "8px" }}>
              {energy.week.map((day, index) => (
                <span
                  key={index}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    color: day.state === "today" ? "var(--accent)" : undefined,
                  }}
                >
                  {day.day}
                </span>
              ))}
            </div>

            <div class="col-foot">
              <div>
                <div class="label">Projected bill</div>
                <div class="big-number" style={{ fontSize: "44px", marginTop: "6px" }}>
                  {energy.projectedBill}
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "var(--muted)",
                    marginTop: "4px",
                  }}
                >
                  {energy.projectedNote}
                </div>
              </div>
              <button type="button" class="btn btn--small">
                Set a budget
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  },
});
