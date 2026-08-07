/**
 * The synthwave grid behind everything — two perspective planes, a floor and
 * a ceiling, running toward the viewer.
 *
 * Deliberately not a client component: it holds no state and reads nothing,
 * so it ships as plain markup with zero JS. Whether it moves is decided in
 * CSS off `body.backdrop-still`, which `useLiveBackdrop` toggles — see
 * lib/hooks.ts.
 */
export function GridBackdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <div className="backdrop__plane backdrop__floor" />
      <div className="backdrop__plane backdrop__ceil" />
      {/* Drawn after the planes so the neon edge sits over where the grid
          converges — which is also the messiest part to render. */}
      <div className="backdrop__horizon backdrop__horizon--floor" />
      <div className="backdrop__horizon backdrop__horizon--ceil" />
    </div>
  );
}
