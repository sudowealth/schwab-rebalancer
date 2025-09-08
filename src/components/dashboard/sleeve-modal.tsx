import { BarChart3 } from "lucide-react";

interface SleeveMember {
  id: string;
  ticker: string;
  rank: number;
  isActive: boolean;
  isRestricted: boolean;
}

interface SleevePosition {
  id: string;
  ticker: string;
  sleeveId: string;
  qty: number;
  costBasis: number;
  openedAt: Date;
  currentPrice: number;
  marketValue: number;
  dollarGainLoss: number;
  percentGainLoss: number;
}

interface Sleeve {
  id: string;
  name: string;
  position?: SleevePosition | null;
  members?: SleeveMember[];
}

interface SleeveModalProps {
  isOpen: boolean;
  onClose: () => void;
  sleeve: Sleeve | null;
}

export function SleeveModal({ isOpen, onClose, sleeve }: SleeveModalProps) {
  if (!isOpen || !sleeve) return null;

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      onClick={onClose}
    >
      <div
        className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mt-3 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {sleeve.name || "Sleeve Details"}
          </h3>

          <div className="text-left">
            {/* Current Position */}
            {sleeve.position && (
              <div className="mb-4 p-3 bg-blue-50 rounded-md">
                <h4 className="text-sm font-medium text-blue-900 mb-2">
                  Current Position
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-600">Ticker:</span>
                    <span className="text-blue-900 font-medium">
                      {sleeve.position.ticker}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Quantity:</span>
                    <span className="text-blue-900">
                      {sleeve.position.qty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Price:</span>
                    <span className="text-blue-900">
                      ${sleeve.position.currentPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Cost Basis:</span>
                    <span className="text-blue-900">
                      ${sleeve.position.costBasis.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Market Value:</span>
                    <span className="text-blue-900 font-medium">
                      ${sleeve.position.marketValue.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span
                      className={`${sleeve.position.dollarGainLoss >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {sleeve.position.dollarGainLoss >= 0 ? "Gain:" : "Loss:"}
                    </span>
                    <span
                      className={`font-medium ${
                        sleeve.position.dollarGainLoss >= 0
                          ? "text-green-700"
                          : "text-red-700"
                      }`}
                    >
                      $
                      {Math.abs(sleeve.position.dollarGainLoss).toLocaleString()}{" "}
                      ({Math.abs(sleeve.position.percentGainLoss).toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Sleeve Members */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Sleeve Members
              </h4>
              <div className="space-y-2">
                {sleeve.members
                  ?.sort((a, b) => a.rank - b.rank)
                  .map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full text-xs font-medium">
                          {member.rank}
                        </span>
                        <span
                          className={`${
                            !member.isActive
                              ? "text-gray-400 line-through"
                              : "text-gray-900"
                          }`}
                        >
                          {member.ticker}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {member.isRestricted && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Restricted
                          </span>
                        )}
                        {sleeve.position?.ticker === member.ticker && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Held
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="items-center px-4 py-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}