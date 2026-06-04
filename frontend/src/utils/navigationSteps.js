/**
 * Construit les étapes de guidage à partir du résultat pathfinder.
 */
export function buildNavigationSteps(result) {
  if (!result?.segments?.length) return [];
  const steps = [];
  result.segments.forEach((seg, i) => {
    if (i === 0) {
      steps.push({
        id: `step-${i}-from`,
        buildingId: seg.from.id,
        building: seg.from,
        label: seg.from.nom,
        distanceToNext: seg.distance,
        index: steps.length,
      });
    }
    steps.push({
      id: `step-${i}-to`,
      buildingId: seg.to.id,
      building: seg.to,
      label: seg.to.nom,
      distanceToNext: i < result.segments.length - 1 ? result.segments[i + 1].distance : 0,
      index: steps.length,
    });
  });
  return steps;
}
