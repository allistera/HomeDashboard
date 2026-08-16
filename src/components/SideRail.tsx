import { defineComponent } from "vue";
import { RouterLink } from "vue-router";

const links = [
  { label: "HOME", to: "/" },
  { label: "ROOMS", to: "/rooms" },
  { label: "ENERGY", to: "/energy" },
  { label: "SECURITY", to: "/security" },
];

export default defineComponent({
  name: "SideRail",
  setup() {
    return () => (
      <nav class="rail" aria-label="Main">
        <div class="rail__dot" />
        <div class="rail__links">
          {links.map((link) => (
            <RouterLink
              key={link.to}
              to={link.to}
              class="rail__link"
              exactActiveClass="rail__link--active"
            >
              {link.label}
            </RouterLink>
          ))}
        </div>
      </nav>
    );
  },
});
