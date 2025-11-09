import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Nfc, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface NFCScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function NFCScanner({ onScan, onClose }: NFCScannerProps) {
  const [error, setError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [hasNFC, setHasNFC] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkNFCSupport();
  }, []);

  const checkNFCSupport = async () => {
    if (!('NDEFReader' in window)) {
      setError('NFC is not supported on this device/browser. NFC scanning requires Chrome/Edge on Android.');
      setHasNFC(false);
      return;
    }
    setHasNFC(true);
    startNFCScanning();
  };

  const startNFCScanning = async () => {
    try {
      setIsScanning(true);
      // @ts-ignore - Web NFC API types
      const ndef = new NDEFReader();
      
      await ndef.scan();
      
      toast({
        title: '📱 NFC Ready',
        description: 'Hold your device near an NFC tag to scan',
      });

      // @ts-ignore
      ndef.addEventListener('reading', ({ message, serialNumber }) => {
        console.log('NFC tag detected:', serialNumber);
        
        // Read the first text record from the NFC tag
        for (const record of message.records) {
          if (record.recordType === 'text') {
            const textDecoder = new TextDecoder(record.encoding || 'utf-8');
            const text = textDecoder.decode(record.data);
            console.log('NFC text content:', text);
            onScan(text);
            return;
          }
        }
        
        // If no text record, use serial number
        onScan(serialNumber);
      });

      // @ts-ignore
      ndef.addEventListener('readingerror', () => {
        setError('Error reading NFC tag. Please try again.');
      });

    } catch (err: any) {
      console.error('NFC scanning error:', err);
      if (err.name === 'NotAllowedError') {
        setError('NFC permission denied. Please allow NFC access in your browser settings.');
      } else if (err.name === 'NotSupportedError') {
        setError('NFC is not supported on this device.');
      } else {
        setError(err.message || 'Failed to start NFC scanning.');
      }
      setIsScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Nfc className="h-5 w-5" />
                Scan NFC Tag
              </h3>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="relative aspect-square w-full bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg overflow-hidden flex items-center justify-center">
                  {isScanning ? (
                    <div className="text-center p-6 space-y-4">
                      <div className="relative w-32 h-32 mx-auto">
                        <Nfc className="h-32 w-32 text-primary animate-pulse" />
                        <div className="absolute inset-0 border-4 border-primary rounded-full animate-ping opacity-75" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-semibold">NFC Ready</p>
                        <p className="text-sm text-muted-foreground">
                          Hold your device near an NFC tag
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-6">
                      <Nfc className="h-32 w-32 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Initializing NFC scanner...
                      </p>
                    </div>
                  )}
                </div>
                
                {hasNFC && (
                  <Alert>
                    <AlertDescription>
                      <strong>Tip:</strong> Hold your device's back (near the camera) close to the NFC tag for 1-2 seconds.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
