import { useState, useEffect } from 'react';
import { X, User, MapPin, Package, Truck, Tag, FileText, Link2, Info } from 'lucide-react';
import { API_BASE } from '../config';

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

function PreviewSection({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 border-b border-slate-200">
        <Icon className="w-4 h-4 text-indigo-600" />
        <span className="font-semibold text-slate-800 text-sm">{title}</span>
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

export default function MissionPreviewModal({ mission, onClose, onOpenPreview, onOpenLinkedPreview, onRequestLinkEmptyBox, embedded, compact }) {
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
  }, [mission?.type, mission?.id]);

  if (!mission) return null;

  const isPickup = mission.type === 'pickup';
  const addr = mission.address || mission.senderAddress;
  const receiverAddr = mission.receiverAddress;
  const deliveries = mission.deliveries ?? [];
  const hasDeliveries = deliveries.length > 0;

  const openLinked = onOpenLinkedPreview || onOpenPreview;

  const card = (
    <div
      className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-6 flex flex-col max-h-[90vh]"
      style={embedded ? { minWidth: compact ? 320 : 360, maxWidth: compact ? 400 : 540 } : {}}
      onClick={(e) => e.stopPropagation()}
    >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-lg">Mission Preview</h2>
              <p className="font-mono text-sm text-indigo-600">{mission.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Type & Status */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${isPickup ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {isPickup ? <Truck className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
              {TYPE_LABELS[mission.type] || mission.type}
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700">
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

          <PreviewSection icon={MapPin} title={isPickup ? 'Pickup Address' : 'Address'}>
            <PreviewRow label="Address" value={addr?.displayAddress} />
            {addr?.apartment && <PreviewRow label="Apartment" value={addr.apartment} />}
            {addr?.floor && <PreviewRow label="Floor" value={addr.floor} />}
            {addr?.lat != null && (
              <PreviewRow label="Coords" value={`${Number(addr.lat).toFixed(5)}, ${Number(addr.lng).toFixed(5)}`} />
            )}
          </PreviewSection>

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
                      className="p-2 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-colors"
                      title="Preview"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  )}
                  {onRequestLinkEmptyBox && (
                    <button
                      type="button"
                      onClick={() => onRequestLinkEmptyBox(mission)}
                      className="p-2 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-colors"
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
          {!isPickup && linkedPickups.length > 0 && (
            <PreviewSection icon={Link2} title="Linked Pickup Missions">
              {linkedPickups.map((p) => (
                <div key={p.id} className="p-3 rounded-lg bg-white border border-slate-200 flex items-start justify-between gap-2">
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
                      className="p-2 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-colors shrink-0"
                      title="Preview"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </PreviewSection>
          )}

          {/* Pickup-specific */}
          {isPickup && (
            <PreviewSection icon={Package} title="Boxes to Collect">
              <PreviewRow label="Count" value={mission.pickupBoxCount} />
              <PreviewRow label="Bring empty boxes" value={mission.bringBoxes === false ? 'No' : mission.bringBoxes ? 'Yes' : null} />
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
                </>
              )}
              {hasDeliveries && (
                <div className="space-y-3">
                  {deliveries.map((d, i) => (
                    <div key={d.id || i} className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                      <p className="text-xs font-semibold text-slate-500 uppercase">Delivery {i + 1}</p>
                      <PreviewRow label="Name" value={d.receiverName} />
                      <PreviewRow label="Phone" value={d.receiverPhone} />
                      <PreviewRow label="Address" value={d.address?.displayAddress} />
                      {d.boxCount != null && <PreviewRow label="Boxes" value={d.boxCount} />}
                      {(d.boxWeights?.length > 0 || d.boxTrackingIds?.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {Array.from({ length: Math.max(d.boxWeights?.length || 0, d.boxTrackingIds?.length || 0) }, (_, j) => {
                            const w = d.boxWeights?.[j];
                            const tid = (d.boxTrackingIds?.[j] || '').trim();
                            const parts = [];
                            if (tid) parts.push(tid);
                            if (w) parts.push(`${w} kg`);
                            if (parts.length === 0) return null;
                            return (
                              <span key={j} className="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                {parts.join(' · ')}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </PreviewSection>
          )}

          {/* Affiliate */}
          {mission.affiliateName && (
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      {card}
    </div>
  );
}
