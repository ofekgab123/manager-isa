import { X, User, MapPin, Package, FileText } from 'lucide-react';
import { formatIls, sumBoxContentsIls } from '../parcelContentUtils';
import CollapsibleParcelContent from './CollapsibleParcelContent';

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

export default function PackagePreviewModal({ packageData, onClose }) {
  if (!packageData) return null;
  const { mission, delivery, packageId } = packageData;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-lg">Package Summary</h2>
              <p className="font-mono text-sm text-indigo-600">{packageId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <PreviewSection icon={User} title="Sender">
            <PreviewRow label="Name" value={mission?.fullName} />
            <PreviewRow label="Phone" value={mission?.customerPhone} />
          </PreviewSection>

          <PreviewSection icon={User} title="Receiver">
            <PreviewRow label="Name" value={delivery?.receiverName} />
            <PreviewRow label="Phone" value={delivery?.receiverPhone} />
          </PreviewSection>

          <PreviewSection icon={MapPin} title="Delivery Address">
            <PreviewRow label="Address" value={delivery?.address?.displayAddress} />
            {delivery?.address?.apartment && <PreviewRow label="Apartment" value={delivery.address.apartment} />}
            {delivery?.address?.floor && <PreviewRow label="Floor" value={delivery.address.floor} />}
            {delivery?.address?.lat != null && (
              <PreviewRow
                label="Coords"
                value={`${Number(delivery.address.lat).toFixed(5)}, ${Number(delivery.address.lng).toFixed(5)}`}
              />
            )}
          </PreviewSection>

          <PreviewSection icon={Package} title="Boxes & Contents">
            <PreviewRow label="Box count" value={delivery?.boxCount} />
            {(delivery?.boxWeights?.length > 0 || delivery?.boxTrackingIds?.length > 0) && (
              <div className="space-y-2 mt-2">
                {Array.from({
                  length: Math.max(delivery?.boxWeights?.length || 0, delivery?.boxTrackingIds?.length || 0),
                }, (_, j) => {
                  const w = delivery?.boxWeights?.[j];
                  const tid = (delivery?.boxTrackingIds?.[j] || '').trim();
                  const parts = [];
                  if (tid) parts.push(`ID: ${tid}`);
                  if (w) parts.push(`${w} kg`);
                  if (parts.length === 0) return null;
                  return (
                    <div key={j} className="text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2">
                      <span className="font-medium text-slate-500">Box {j + 1}:</span> {parts.join(' · ')}
                    </div>
                  );
                })}
              </div>
            )}
            {(delivery?.boxContents?.length > 0) && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <CollapsibleParcelContent
                  title={<p className="text-xs font-semibold text-slate-500 uppercase mb-0">Parcel content</p>}
                  buttonClassName="flex items-center gap-1.5 w-full text-left rounded-lg hover:bg-white -mx-1 px-1 py-1 transition-colors"
                >
                  <div className="space-y-2">
                    {(delivery.boxContents || []).map((boxItems, bi) => {
                      const items = Array.isArray(boxItems) ? boxItems : [];
                      const str = items
                        .filter((it) => it?.description)
                        .map((it) => {
                          const base = `${it.description} ×${it.qty ?? 1}`;
                          const price =
                            it.price != null && it.price !== '' && Number(it.price) > 0
                              ? ` ₪${Number(it.price).toLocaleString()}`
                              : '';
                          return base + price;
                        })
                        .join(', ');
                      if (!str) return null;
                      return (
                        <div key={bi} className="text-sm text-slate-700">
                          <span className="font-medium text-slate-500">Box {bi + 1}:</span> {str}
                        </div>
                      );
                    })}
                    <p className="text-sm font-semibold text-slate-800 mt-2 pt-2 border-t border-slate-200">
                      Content total: {formatIls(sumBoxContentsIls(delivery?.boxContents))}
                    </p>
                  </div>
                </CollapsibleParcelContent>
              </div>
            )}
          </PreviewSection>

          {mission?.notes && (
            <PreviewSection icon={FileText} title="Notes">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{mission.notes}</p>
            </PreviewSection>
          )}
        </div>
      </div>
    </div>
  );
}
