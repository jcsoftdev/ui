/**
 * Keyframes used by the AI set. React 19 hoists and dedupes `<style href precedence>`, so
 * rendering this from several components injects the rules once and needs no stylesheet entry.
 */
export function AiKeyframes() {
  return (
    <style href="jcsoftdev-ui-ai-keyframes" precedence="default">
      {
        "@keyframes ui-ai-dot{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-25%)}}@keyframes ui-ai-caret{50%{opacity:0}}@keyframes ui-ai-shimmer{from{background-position:120% 0}to{background-position:-20% 0}}"
      }
    </style>
  );
}
