import { useState, useEffect } from 'react';
import { X, User, MapPin, Package, Truck, Tag, FileText, Link2, Info, Plus, Globe, AlertTriangle } from 'lucide-react';
import { API_BASE } from '../config';
import CollapsibleParcelContent from './CollapsibleParcelContent';
import { AddressVerificationImagePreview } from './AddressVerificationImage';
import { formatIls, sumAllDeliveriesContentsIls, sumBoxContentsIls } from '../parcelContentUtils';
import { maxPickupLinksForEmptyBox } from '../pickerSlots';
import { shippingDestinationLabel, missionLwRegionId, paymentLocationLabel } from '../shippingDestinations';

const TYPE_LABELS = { pickup: 'Pickup', empty_box: 'Empty Box' };
const STATUS_LABELS = {
  received: 'Received',
  linewhel_transferred: 'Transferred',
  linewhel_scheduled: 'Scheduled',
  collected: 'Collected',
  shipped: 'Shipped',
  completed: 'Completed',
};
const CREATED_BY_LABELS = { customer: 'Customer', customer_service: 'CS' };

function PreviewSection({ icon: Icon, title, children, headerRight }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/80 border-b border-slate-100">
        <Icon className="w-4 h-4 text-indigo-600 shrink-0" />
        <span className="font-semibold text-slate-800 text-sm flex-1 min-w-0">{title}</span>
        {headerRight ? <div className="flex items-center gap-1 shrink-0">{headerRight}</div> : null}
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

function PreviewRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-slate-500 w-32 flex-shrink-0">{label}</span>
      <span className="text-slate-800 font-medium break-words">{String(value)}</span>
    </div>
  );
}

export default function MissionPreviewModal({
  mission,
  onClose,
  onOpenPreview,
  onOpenLinkedPreview,
  onRequestLinkEmptyBox,
  onRequestLinkPickup,
  embedded,
  compact,
  pickupLinkRefreshKey = 0,
}) {
  const [linkedMission, setLinkedMission] = useState(null);
  const [linkedPickups, setLinkedPickups] = useState([]);

  useEffect(() => {
    if (mission?.linkedEmptyBoxMissionId) {
      fetch(`${API_BASE}/missions/${mission.linkedEmptyBoxMissionId}`)
        .then((r) => r.ok ? r.json() : null)
        .then(setLinkedMission)
        .catch(() => setLinkedMission(null));
    } else {
      setLinkedMission(null);
    }
  }, [mission?.linkedEmptyBoxMissionId]);

  useEffect(() => {
    if (mission?.type === 'empty_box' && mission?.id) {
      fetch(`${API_BASE}/missions?type=pickup&linkedEmptyBoxMissionId=${encodeURIComponent(mission.id)}`)
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setLinkedPickups(Array.isArray(data) ? data : []))
        .catch(() => setLinkedPickups([]));
    } else {
      setLinkedPickups([]);
    }
  }, [mission?.type, mission?.id, pickupLinkRefreshKey]);

  if (!mission) return null;

  const isPickup = mission.type === 'pickup';
  const maxLinksEmptyBox = mission.type === 'empty_box' ? maxPickupLinksForEmptyBox(mission) : 0;
  const emptyPickupSlots =
    mission.type === 'empty_box' ? Math.max(0, maxLinksEmptyBox - linkedPickups.length) : 0;
  const addr = mission.address || mission.senderAddress;
  const receiverAddr = mission.receiverAddress;
  const deliveries = mission.deliveries ?? [];
  const hasDeliveries = deliveries.length > 0;

  const openLinked = onOpenLinkedPreview || onOpenPreview;

  const card = (
    <div
      className="modal-content max-w-3xl my-6 max-h-[90vh]"
      style={embedded ? { minWidth: compact ? 320 : 360, maxWidth: compact ? 400 : 540 } : {}}
      onClick={(e) => e.stopPropagation()}
    >
        {/* Header */}
        <div className="modal-header bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-lg">Mission Preview</h2>
              <p className="font-mono text-sm text-indigo-600">{mission.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="action-btn hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body space-y-4">
          {/* Type & Status */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`badge-pill ${isPickup ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {isPickup ? <Truck className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
              {TYPE_LABELS[mission.type] || mission.type}
            </span>
            <span className="badge-pill bg-slate-100 text-slate-700">
              {STATUS_LABELS[mission.status] || mission.status}
            </span>
            {mission.createdBy && (
              <span className="text-xs text-slate-500 px-2 py-1">
                {CREATED_BY_LABELS[mission.createdBy] || mission.createdBy}
              </span>
            )}
            {mission.createdAt && (
              <span className="text-xs text-slate-500">
                {new Date(mission.createdAt).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Sender / Pickup */}
          <PreviewSection icon={User} title={isPickup ? 'Pickup — Sender' : 'Customer'}>
            <PreviewRow label="Name" value={mission.fullName} />
            <PreviewRow label="Phone" value={mission.customerPhone} />
          </PreviewSection>

          {!isPickup && mission.type === 'empty_box' && !missionLwRegionId(mission) && (
            <div className="text-sm text-amber-700 bg-amber-50/80 border border-amber-100 rounded-xl px-3 py-2">
              Ship to not selected — ask customer or set in edit
            </div>
          )}

          {missionLwRegionId(mission) && !isPickup && (
            <PreviewSection icon={Globe} title="Ship to (after packing)">
              <PreviewRow label="Country" value={shippingDestinationLabel(missionLwRegionId(mission))} />
            </PreviewSection>
          )}

          <PreviewSection icon={MapPin} title={isPickup ? 'Pickup Address' : 'Address'}>
            <PreviewRow label="Address" value={addr?.displayAddress} />
            {addr?.apartment && <PreviewRow label="Apartment" value={addr.apartment} />}
            {addr?.floor && <PreviewRow label="Floor" value={addr.floor} />}
            {addr?.lat != null && (
              <PreviewRow label="Coords" value={`${Number(addr.lat).toFixed(5)}, ${Number(addr.lng).toFixed(5)}`} />
            )}
          </PreviewSection>

          {mission.lionwheel && (
            <PreviewSection icon={Truck} title="LionWheel">
              {mission.lionwheel.trackingLink ? (
                <div className="text-sm">
                  <a
                    href={mission.lionwheel.trackingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 font-medium hover:underline break-all"
                  >
                    Open tracking
                  </a>
                </div>
              ) : null}
              <PreviewRow label="Task ID" value={mission.lionwheel.taskId} />
              <PreviewRow label="Public ID" value={mission.lionwheel.publicId} />
              <PreviewRow label="Barcode" value={mission.lionwheel.barcode} />
              {(mission.lionwheel.taskStatusLabel || typeof mission.lionwheel.taskStatus === 'number') && (
                <PreviewRow label="Status (LionWheel)" value={mission.lionwheel.taskStatusLabel ?? String(mission.lionwheel.taskStatus)} />
              )}
              {mission.lionwheel.taskStatusFetchError && (
                <PreviewRow label="LW status fetch" value={mission.lionwheel.taskStatusFetchError} />
              )}
              {mission.lionwheel.syncError ? (
                <PreviewRow label="Sync error" value={mission.lionwheel.syncError} />
              ) : null}
            </PreviewSection>
          )}

          {/* Linked empty box — pickup only */}
          {isPickup && (
            <PreviewSection icon={Link2} title="Linked Empty Box Mission">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  {linkedMission ? (
                    <>
                      <PreviewRow label="ID" value={linkedMission.id} />
                      <PreviewRow label="Customer" value={linkedMission.fullName} />
                      <PreviewRow label="Phone" value={linkedMission.customerPhone} />
                      <PreviewRow label="Address" value={linkedMission.address && linkedMission.address.displayAddress} />
                    </>
                  ) : mission.linkedEmptyBoxMissionId ? (
                    <PreviewRow label="Mission ID" value={mission.linkedEmptyBoxMissionId} />
                  ) : (
                    <span className="text-sm text-slate-500 italic">No link — standalone pickup</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {openLinked && linkedMission && (
                    <button
                      type="button"
                      onClick={() => openLinked(linkedMission)}
                      className="action-btn hover:bg-indigo-50 text-indigo-600"
                      title="Preview"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  )}
                  {onRequestLinkEmptyBox && (
                    <button
                      type="button"
                      onClick={() => onRequestLinkEmptyBox(mission)}
                      className="action-btn hover:bg-indigo-50 text-indigo-600"
                      title={linkedMission || mission.linkedEmptyBoxMissionId ? 'Change link' : 'Link to empty box'}
                    >
                      <Link2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </PreviewSection>
          )}

          {/* Linked pickup missions — empty box only */}
          {!isPickup && mission.type === 'empty_box' && mission.id && (
            <PreviewSection
              icon={Link2}
              title="Linked Pickup Missions"
              headerRight={
                onRequestLinkPickup && emptyPickupSlots > 0 ? (
                  <button
                    type="button"
                    onClick={() => onRequestLinkPickup(mission)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-200"
                    title="Link pickup mission"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                ) : null
              }
            >
              <p className="text-xs text-slate-500 -mt-1 mb-2">
                {mission.type === 'empty_box'
                  ? `${linkedPickups.length} / ${maxLinksEmptyBox} slots`
                  : ''}
              </p>
              <div className="space-y-2">
                {linkedPickups.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-white border border-slate-200 flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <PreviewRow label="ID" value={p.id} />
                      <PreviewRow label="Customer" value={p.fullName} />
                      <PreviewRow label="Phone" value={p.customerPhone} />
                      <PreviewRow label="Boxes to collect" value={p.pickupBoxCount} />
                    </div>
                    {openLinked && (
                      <button
                        type="button"
                        onClick={() => openLinked(p)}
                        className="action-btn hover:bg-indigo-50 text-indigo-600 shrink-0"
                        title="Preview"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {Array.from({ length: emptyPickupSlots }).map((_, i) => (
                  <div
                    key={`empty-pickup-${i}`}
                    className="p-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-400"
                  >
                    No pickup linked
                  </div>
                ))}
              </div>
            </PreviewSection>
          )}

          {/* Pickup-specific */}
          {isPickup && (
            <PreviewSection icon={Package} title="Boxes to Collect">
              <PreviewRow label="Count" value={mission.pickupBoxCount} />
              <PreviewRow label="Bring empty boxes" value={mission.bringBoxes === false ? 'No' : mission.bringBoxes ? 'Yes' : null} />
            </PreviewSection>
          )}

          {isPickup && missionLwRegionId(mission) === 'thailand' && (
            <PreviewSection icon={Globe} title="Payment">
              {mission.paymentLocation ? (
                <PreviewRow label="Payment location" value={paymentLocationLabel(mission.paymentLocation)} />
              ) : (
                <p className="text-sm text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Payment location not set
                </p>
              )}
            </PreviewSection>
          )}

          {/* Box selection (empty boxes to bring) */}
          {((mission.boxSelection?.large || 0) + (mission.boxSelection?.small || 0)) > 0 && (
            <PreviewSection icon={Package} title="Boxes to Bring">
              {mission.boxSelection?.large > 0 && <PreviewRow label="ISA-BOX-70 (Large)" value={mission.boxSelection.large} />}
              {mission.boxSelection?.small > 0 && <PreviewRow label="ISA-BOX-35 (Small)" value={mission.boxSelection.small} />}
            </PreviewSection>
          )}

          {/* Receiver / Delivery */}
          {(mission.receiverName || mission.receiverPhone || receiverAddr || hasDeliveries) && (
            <PreviewSection icon={User} title="Receiver / Delivery">
              {!hasDeliveries && (
                <>
                  <PreviewRow label="Name" value={mission.receiverName} />
                  <PreviewRow label="Phone" value={mission.receiverPhone} />
                  <PreviewRow label="Address" value={receiverAddr?.displayAddress} />
                  <AddressVerificationImagePreview imageUrl={receiverAddr?.imageUrl} />
                </>
              )}
              {hasDeliveries && (
                <div className="space-y-3">
                  {deliveries.map((d, i) => (
                    <div key={d.id || i} className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
                      <p className="label mb-1">Delivery {i + 1}</p>
                      <PreviewRow label="Name" value={d.receiverName} />
                      <PreviewRow label="Phone" value={d.receiverPhone} />
                      {missionLwRegionId(mission) === 'thailand' && (
                        <PreviewRow label="Phone 2" value={d.receiverPhone2} />
                      )}
                      <PreviewRow label="Address" value={d.address?.displayAddress} />
                      <AddressVerificationImagePreview imageUrl={d.address?.imageUrl} />
                      {d.boxCount != null && <PreviewRow label="Boxes" value={d.boxCount} />}
                      {(d.boxWeights?.length > 0 || d.boxTrackingIds?.length > 0 || d.boxThailandRefs?.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {Array.from({
                            length: Math.max(
                              d.boxWeights?.length || 0,
                              d.boxTrackingIds?.length || 0,
                              d.boxThailandRefs?.length || 0
                            ),
                          }, (_, j) => {
                            const w = d.boxWeights?.[j];
                            const tid = (d.boxTrackingIds?.[j] || '').trim();
                            const thRef = (d.boxThailandRefs?.[j] || '').trim();
                            const parts = [];
                            if (tid) parts.push(tid);
                            if (thRef) parts.push(`ID2: ${thRef}`);
                            if (w) parts.push(`${w} kg`);
                            if (parts.length === 0) return null;
                            return (
                              <span key={j} className="badge bg-slate-100 text-slate-700">
                                {parts.join(' · ')}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {(d.boxContents?.length > 0) && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <CollapsibleParcelContent
                            title={<p className="label mb-0">Parcel content</p>}
                            buttonClassName="flex items-center gap-1.5 w-full text-left rounded-lg hover:bg-slate-50 -mx-1 px-1 py-0.5 transition-colors"
                          >
                            <div className="space-y-1">
                              {d.boxContents.map((boxItems, bi) => {
                                const items = Array.isArray(boxItems) ? boxItems : [];
                                const str = items
                                  .filter((it) => it?.description)
                                  .map((it) => {
                                    const base = `${it.description} ×${it.qty ?? 1}`;
                                    const price = it.price != null && it.price !== '' && Number(it.price) > 0
                                      ? ` ₪${Number(it.price).toLocaleString()}`
                                      : '';
                                    return base + price;
                                  })
                                  .join(', ');
                                if (!str) return null;
                                return (
                                  <div key={bi} className="text-xs text-slate-700">
                                    <span className="font-medium text-slate-500">Box {bi + 1}:</span> {str}
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-xs font-semibold text-slate-800 mt-2 pt-2 border-t border-slate-100">
                              Content total: {formatIls(sumBoxContentsIls(d.boxContents))}
                            </p>
                          </CollapsibleParcelContent>
                        </div>
                      )}
                    </div>
                  ))}
                  {deliveries.length > 1 && (
                    <p className="text-sm font-semibold text-slate-800 px-0.5 pt-1">
                      All deliveries content total: {formatIls(sumAllDeliveriesContentsIls(deliveries))}
                    </p>
                  )}
                </div>
              )}
            </PreviewSection>
          )}

          {/* Affiliate (pickup missions only) */}
          {mission.type === 'pickup' && mission.affiliateName && (
            <PreviewSection icon={Tag} title="Affiliate">
              <PreviewRow label="Name" value={mission.affiliateName} />
              {mission.discountAmount != null && <PreviewRow label="Discount" value={`₪${mission.discountAmount}`} />}
            </PreviewSection>
          )}

          {/* Notes */}
          {mission.notes && (
            <PreviewSection icon={FileText} title="Notes">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{mission.notes}</p>
            </PreviewSection>
          )}
        </div>
      </div>
  );

  if (embedded) return card;
  return (
    <div className="modal-overlay z-50 items-start overflow-y-auto" onClick={onClose}>
      {card}
    </div>
  );
}
