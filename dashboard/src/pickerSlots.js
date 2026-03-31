/**
 * Max pickup missions that may link to one empty_box mission:
 * sum of large + small boxes; if none set, allow 1 link (same as MissionDetails).
 */
export function maxPickupLinksForEmptyBox(emptyBoxMission) {
  if (!emptyBoxMission) return 1;
  const t = (emptyBoxMission.boxSelection?.large || 0) + (emptyBoxMission.boxSelection?.small || 0);
  return t > 0 ? t : 1;
}
