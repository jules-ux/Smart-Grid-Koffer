import React, { useState, useEffect, useRef } from 'react';
import { X, ScanLine, CheckCircle2, AlertOctagon, QrCode, Cpu, Smartphone, Camera, CameraOff, Keyboard, ArrowRight } from 'lucide-react';
import { formatRFID } from '../services/inventoryService';
import { Html5Qrcode } from 'html5-qrcode';

export type ScanMode = 'QR_BACKPACK' | 'RFID_MODULE';
export type ReplacementStep = 'SCAN_OLD' | 'SCAN_NEW';

interface ScannerModalProps {
  mode: ScanMode;
  step: ReplacementStep | null;
  targetModuleId?: string;
  targetModuleName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: string) => Promise<{success: boolean; message: string} | void>;
  onSkip?: () => void;
  isConfiguring?: boolean;
}

type CameraStatus = 'IDLE' | 'STARTING' | 'SCANNING' | 'ERROR';

const ScannerModal: React.FC<ScannerModalProps> = ({ 
  mode,
  step,
  targetModuleId, 
  targetModuleName, 
  isOpen, 
  onClose,
  onSuccess,
  onSkip,
  isConfiguring
}) => {
  const [inputVal, setInputVal] = useState('');
  const [feedback, setFeedback] = useState<{success: boolean; message: string} | null>(null);
  
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('IDLE');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [nfcStatus, setNfcStatus] = useState<string>('Controleren op NFC support...');
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const readerId = "qr-reader-viewport";

  useEffect(() => {
    if (isOpen) {
      setInputVal('');
      setFeedback(null);
      setCameraError(null);
      setCameraStatus('IDLE');
      
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);

      if (mode === 'RFID_MODULE') {
        startNFC();
      }
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, mode]);

  const handleStartCameraClick = () => {
    if (cameraStatus === 'IDLE' || cameraStatus === 'ERROR') {
      startCamera();
    }
  };

  const startCamera = async () => {
    setCameraStatus('STARTING');
    setCameraError(null);
    try {
      await new Promise(r => setTimeout(r, 100));
      const elementExists = document.getElementById(readerId);
      if (!elementExists) {
          throw new Error("QR Reader element not found in DOM");
      };

      if (scannerRef.current) await stopCamera();

      const html5QrCode = new Html5Qrcode(readerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
            handleVerify(decodedText);
        },
        (errorMessage) => { /* ignore scan errors */ }
      );
      setCameraStatus('SCANNING');
    } catch (err: any) {
      console.error("Camera start failed", err);
      setCameraError("Camera niet beschikbaar of permissie geweigerd. Gebruik handmatige invoer.");
      setCameraStatus('ERROR');
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
        try {
            await scannerRef.current.stop();
        } catch (err) {
            console.warn("Ignoring camera stop error.", err);
        }
    }
    if (scannerRef.current) {
        try {
           scannerRef.current.clear();
        } catch(e) {
            // ignore clear error
        }
        scannerRef.current = null;
    }
    setCameraStatus('IDLE');
  };

  const startNFC = async () => {
    if ('NDEFReader' in window) {
      try {
        // @ts-ignore
        const ndef = new NDEFReader();
        await ndef.scan();
        setNfcStatus("NFC Actief! Houd tag tegen achterkant telefoon.");
        
        ndef.onreading = async (event: any) => {
          const decoder = new TextDecoder();
          let scannedId = '';
          if (event.message && event.message.records) {
              for (const record of event.message.records) {
                  if (record.recordType === "text") {
                      scannedId = decoder.decode(record.data);
                  }
              }
          }
          if (scannedId) await handleVerify(scannedId);
        };
      } catch (error) {
        setNfcStatus("NFC Toegang geweigerd of niet ondersteund.");
      }
    } else {
      setNfcStatus("Web NFC niet ondersteund in deze browser.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleVerify(inputVal);
  };

  const handleVerify = async (scannedData: string) => {
    if (!scannedData) return;
    const cleanData = scannedData.trim();
    if (navigator.vibrate) navigator.vibrate(50);
    setFeedback(null);

    const result = await onSuccess(cleanData);

    if (mode === 'QR_BACKPACK') {
      onClose();
      return;
    } 
    
    if (mode === 'RFID_MODULE' && result) {
      setFeedback({ success: result.success, message: result.message });
      
      if (step === 'SCAN_OLD' && result.success) {
        setInputVal('');
        return;
      }

      if (result.success) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } else {
      onClose();
    }
    setInputVal('');
  };

  if (!isOpen) return null;

  const isScanningOld = mode === 'RFID_MODULE' && step === 'SCAN_OLD';
  const isScanningNew = mode === 'RFID_MODULE' && step === 'SCAN_NEW';
  
  const getTitle = () => {
    if (isScanningOld) return 'Stap 1: Verwijder Zakje';
    if (isScanningNew) {
      if (isConfiguring) return 'Stap 1: Plaats Zakje';
      return 'Stap 2: Plaats Zakje';
    }
    if (mode === 'QR_BACKPACK') return 'Scan Koffer';
    return 'Scan RFID Tag';
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-700 flex flex-col max-h-[90vh]">
        
        <div className="bg-slate-50 p-4 flex justify-between items-center text-slate-800 shrink-0 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {mode === 'QR_BACKPACK' ? <QrCode className="w-5 h-5 text-primary-700" /> : <Cpu className="w-5 h-5 text-primary-700" />}
            <h2 className="font-semibold">{getTitle()}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {mode === 'RFID_MODULE' && targetModuleName && (
             <div className="bg-slate-100 p-4 border-b border-slate-200 shrink-0">
               <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                 {isScanningOld ? 'Te Verwijderen Module' : 'Te Plaatsen Module'}
               </p>
               <h3 className="text-lg font-bold text-slate-800">{targetModuleName}</h3>
               {isScanningOld && (
                 <p className="font-mono text-slate-400 text-sm">
                   Scan ID: {formatRFID(targetModuleId || '')}
                 </p>
               )}
               {isScanningNew && !isConfiguring && (
                 <p className="font-mono text-slate-400 text-sm">
                   Vervangt ID: {formatRFID(targetModuleId || '')}
                 </p>
               )}
             </div>
        )}

        <div className="relative bg-slate-900 flex-1 min-h-[300px] flex flex-col items-center justify-center overflow-hidden">
          {mode === 'QR_BACKPACK' && (
             <div className="w-full h-full relative">
                <div id={readerId} className={`w-full h-full object-cover ${cameraStatus === 'SCANNING' ? '' : 'hidden'}`}></div>
                
                {cameraStatus === 'IDLE' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
                        <button onClick={handleStartCameraClick} className="bg-primary-700 hover:bg-primary-800 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors">
                            <Camera className="w-5 h-5" />
                            Start Camera
                        </button>
                        <p className="text-xs text-slate-400 mt-4">Of gebruik het invoerveld hieronder.</p>
                    </div>
                )}
                
                {cameraStatus === 'STARTING' && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/80">
                        Camera starten...
                    </div>
                )}

                {cameraStatus === 'ERROR' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
                        <CameraOff className="w-12 h-12 mb-4 text-slate-500" />
                        <p className="text-sm font-medium">{cameraError}</p>
                        <button onClick={handleStartCameraClick} className="mt-4 text-sm text-primary-400 font-semibold hover:underline">
                            Probeer opnieuw
                        </button>
                    </div>
                )}

                {cameraStatus === 'SCANNING' && (
                    <div className="absolute inset-0 pointer-events-none border-[40px] border-black/50">
                        <div className="w-full h-full border-2 border-primary-500 relative">
                             <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-white/80 -mt-1 -ml-1"></div>
                             <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-white/80 -mt-1 -mr-1"></div>
                             <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-white/80 -mb-1 -ml-1"></div>
                             <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-white/80 -mb-1 -mr-1"></div>
                        </div>
                        <p className="absolute bottom-4 left-0 right-0 text-center text-white/80 text-xs font-medium">Richt op QR Code</p>
                    </div>
                )}
             </div>
          )}

          {mode === 'RFID_MODULE' && (
             <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                <div className={`w-32 h-32 rounded-full border-4 ${isScanningOld ? 'border-Danger-500/30' : 'border-Success-500/30'} flex items-center justify-center mb-6 relative`}>
                     <div className={`absolute inset-0 rounded-full border-4 ${isScanningOld ? 'border-Danger' : 'border-Success'} border-t-transparent animate-spin`}></div>
                     <Smartphone className={`w-12 h-12 ${isScanningOld ? 'text-Danger' : 'text-Success'}`} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">
                  {isScanningOld ? 'Scan om te Verwijderen' : 'Scan om te Plaatsen'}
                </h3>
                <p className={`${isScanningOld ? 'text-Danger-400' : 'text-Success-400'} text-sm animate-pulse`}>{nfcStatus}</p>
             </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
          <div className="relative">
             <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
             <input
               ref={inputRef}
               type="text"
               value={inputVal}
               onChange={(e) => setInputVal(e.target.value)}
               onKeyDown={handleKeyDown}
               placeholder={mode === 'QR_BACKPACK' ? "Typ ID of Naam..." : "Scan of typ RFID code..."}
               className="block w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
             />
             <button 
                onClick={() => handleVerify(inputVal)}
                className="absolute inset-y-0 right-0 px-4 text-primary-600 font-bold text-sm hover:bg-primary-50 rounded-r-lg"
             >
                OK
             </button>
          </div>

          {isScanningOld && onSkip && (
            <div className="mt-3 text-center">
              <button 
                onClick={onSkip} 
                className="text-xs text-slate-500 hover:text-primary-600 font-semibold underline"
              >
                Zakje ontbreekt? Sla deze stap over.
              </button>
            </div>
          )}

          {feedback && (
            <div className={`mt-3 p-3 rounded-lg flex items-start gap-3 animate-in slide-in-from-bottom-2 ${feedback.success ? 'bg-Success-50 text-Success-600' : 'bg-Danger-50 text-Danger-600'}`}>
              {feedback.success ? <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" /> : <AlertOctagon className="w-5 h-5 mt-0.5 shrink-0" />}
              <div className="text-sm font-medium">{feedback.message}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScannerModal;