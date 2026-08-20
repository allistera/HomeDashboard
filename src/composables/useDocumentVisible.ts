import { onScopeDispose, ref, type Ref } from "vue";

export function useDocumentVisible(): Ref<boolean> {
  const visible = ref(document.visibilityState !== "hidden");

  const sync = () => {
    visible.value = document.visibilityState !== "hidden";
  };

  document.addEventListener("visibilitychange", sync);
  onScopeDispose(() => document.removeEventListener("visibilitychange", sync));
  return visible;
}
