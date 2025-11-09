import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Nfc, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NFCWriterProps {
  open: boolean;
  onClose: () => void;
  checkpointData: string;
  checkpointName: string;
}

export function NFCWriter({ open, onClose, checkpointData, checkpointName }: NFCWriterProps) {
  const [error, setError] = useState<string>('');
  const [isWriting, setIsWriting] = useState(false);
  const [writeSuccess, setWriteSuccess] = useState(false);
  const { toast } = useToast();

  const handleWrite = async () => {
    if (!('NDEFReader' in window)) {
      setError('NFC writing is not supported on this device/browser. NFC requires Chrome/Edge on Android.');
      return;
    }

    try {
      setIsWriting(true);
      setError('');
      setWriteSuccess(false);

      // @ts-ignore - Web NFC API types
      const ndef = new NDEFReader();

      toast({
        title: '📱 Ready to Write',
        description: 'Hold your device near a blank NFC tag',
      });

      await ndef.write({
        records: [
          {
            recordType: 'text',
            data: checkpointData,
          },
        ],
      });

      setWriteSuccess(true);
      setIsWriting(false);

      toast({
        title: '✅ NFC Tag Written',
        description: `Successfully wrote checkpoint "${checkpointName}" to NFC tag.`,
      });

      // Auto close after 2 seconds on success
      setTimeout(() => {
        onClose();
        setWriteSuccess(false);
      }, 2000);

    } catch (err: any) {
      console.error('NFC writing error:', err);
      setIsWriting(false);
      
      if (err.name === 'NotAllowedError') {
        setError('NFC permission denied. Please allow NFC access in your browser settings.');
      } else if (err.name === 'NotSupportedError') {
        setError('NFC writing is not supported on this device.');
      } else if (err.name === 'NetworkError') {
        setError('NFC tag is not writable or out of range. Please try again.');
      } else {
        setError(err.message || 'Failed to write to NFC tag.');
      }

      toast({
        variant: 'destructive',
        title: 'Write Failed',
        description: 'Could not write to NFC tag. Please try again.',
      });
    }
  };

  const handleClose = () => {
    setError('');
    setWriteSuccess(false);
    setIsWriting(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Nfc className="h-5 w-5" />
            Write NFC Tag
          </DialogTitle>
          <DialogDescription>
            Write checkpoint "{checkpointName}" to an NFC tag
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {writeSuccess ? (
            <div className="text-center py-8 space-y-4">
              <CheckCircle className="h-16 w-16 text-success mx-auto" />
              <div>
                <p className="text-lg font-semibold text-success">Success!</p>
                <p className="text-sm text-muted-foreground">NFC tag written successfully</p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg p-8 flex items-center justify-center">
                {isWriting ? (
                  <div className="text-center space-y-4">
                    <div className="relative w-24 h-24 mx-auto">
                      <Nfc className="h-24 w-24 text-primary animate-pulse" />
                      <div className="absolute inset-0 border-4 border-primary rounded-full animate-ping opacity-75" />
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold">Writing...</p>
                      <p className="text-sm text-muted-foreground">
                        Hold near tag
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <Nfc className="h-24 w-24 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Click "Write Tag" and hold your device near a blank NFC tag
                    </p>
                  </div>
                )}
              </div>

              <Alert>
                <AlertDescription>
                  <strong>Requirements:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Android device with NFC enabled</li>
                    <li>Chrome or Edge browser</li>
                    <li>Blank NFC tag (NDEF compatible)</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              {writeSuccess ? 'Close' : 'Cancel'}
            </Button>
            {!writeSuccess && (
              <Button
                className="flex-1"
                onClick={handleWrite}
                disabled={isWriting}
              >
                <Nfc className="mr-2 h-4 w-4" />
                {isWriting ? 'Writing...' : 'Write Tag'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
