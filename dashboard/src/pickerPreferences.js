/** Keys shared with PickupMissionPickerModal & EmptyBoxMissionPickerModal */
export const LS_PICKUP_SEARCH = 'manager-isa:pickupMissionPickerSearch';
export const LS_PICKUP_LAST_CHOSEN_ID = 'manager-isa:pickupMissionPickerLastChosenId';
export const LS_EMPTYBOX_SEARCH = 'manager-isa:emptyBoxMissionPickerSearch';
export const LS_EMPTYBOX_LAST_CHOSEN_ID = 'manager-isa:emptyBoxMissionPickerLastChosenId';

export function notifyPickerPreferenceChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('picker-prefs-changed'));
  }
}

export function readLastChosenFromPickers() {
  try {
    return {
      pickupId: localStorage.getItem(LS_PICKUP_LAST_CHOSEN_ID) || null,
      emptyBoxId: localStorage.getItem(LS_EMPTYBOX_LAST_CHOSEN_ID) || null,
    };
  } catch {
    return { pickupId: null, emptyBoxId: null };
  }
}
