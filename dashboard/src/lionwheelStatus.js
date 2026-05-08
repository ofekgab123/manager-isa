/** LionWheel tasks/show status — must match server/lionwheel.js */
export const LIONWHEEL_TASK_STATUS_COMPLETED = 3;

export function isAffiliatePickupCompletedInLionWheel(mission) {
  return (
    mission?.type === 'pickup' &&
    mission?.affiliateName &&
    Number(mission?.lionwheel?.taskStatus) === LIONWHEEL_TASK_STATUS_COMPLETED
  );
}
