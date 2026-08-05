/**
 * One-off / manual sync: fetch LionWheel task status from API and update mission.lionwheel in DB.
 * Usage: node --env-file=.env scripts/syncLwTaskStatus.mjs <taskId> [taskId...]
 */
import { readMissions, updateMissionsData } from '../storage.js';
import {
  fetchLionWheelTaskShow,
  lionWheelTaskStatusLabel,
  lionWheelDestinationFromMission,
} from '../lionwheel.js';

const taskIds = process.argv.slice(2).map((s) => parseInt(s, 10)).filter(Number.isFinite);
if (taskIds.length === 0) {
  console.error('Usage: node --env-file=.env scripts/syncLwTaskStatus.mjs <taskId> [taskId...]');
  process.exit(1);
}

const missions = await readMissions();

for (const taskId of taskIds) {
  const mission = missions.find((m) => Number(m.lionwheel?.taskId) === taskId);
  if (!mission) {
    console.error(`Task ${taskId}: no mission found with this lionwheel.taskId`);
    continue;
  }

  const destination = lionWheelDestinationFromMission(mission);
  if (!destination) {
    console.error(`Task ${taskId} (${mission.id}): no india/thailand destination on mission`);
    continue;
  }

  const prev = mission.lionwheel?.taskStatus;
  const prevLabel = mission.lionwheel?.taskStatusLabel;

  const result = await fetchLionWheelTaskShow(taskId, destination, {
    originalOrderId: mission.id,
  });

  if (!result.ok) {
    console.error(`Task ${taskId} (${mission.id}): fetch failed — ${result.error || result.reason || 'unknown'}`);
    continue;
  }

  const taskStatus = result.taskStatus;
  const taskStatusLabel = lionWheelTaskStatusLabel(taskStatus);
  const updated = {
    ...mission,
    lionwheel: {
      ...mission.lionwheel,
      taskStatus,
      taskStatusLabel,
      taskStatusFetchedAt: new Date().toISOString(),
      taskStatusFetchError: undefined,
      lastStatusSyncSource: 'syncLwTaskStatus.mjs',
    },
  };

  await updateMissionsData(mission.id, updated);
  console.log(
    `Task ${taskId} (${mission.id}): ${prevLabel ?? prev ?? '—'} → ${taskStatusLabel} (${taskStatus})`,
  );
}

process.exit(0);
