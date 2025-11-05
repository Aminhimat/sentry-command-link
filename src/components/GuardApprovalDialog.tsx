import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";

interface GuardApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guard: {
    id: string;
    first_name: string;
    last_name: string;
    approval_reason?: string;
  } | null;
  onApprove: () => void;
  isLoading: boolean;
}

export const GuardApprovalDialog = ({
  open,
  onOpenChange,
  guard,
  onApprove,
  isLoading,
}: GuardApprovalDialogProps) => {
  if (!guard) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Guard Login</DialogTitle>
          <DialogDescription>
            This guard requires approval to login again after being automatically logged out.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Guard Details</h4>
            <p className="text-sm">
              <strong>Name:</strong> {guard.first_name} {guard.last_name}
            </p>
          </div>
          
          {guard.approval_reason && (
            <div>
              <h4 className="font-semibold mb-2">Reason</h4>
              <Badge variant="destructive" className="text-xs">
                {guard.approval_reason}
              </Badge>
            </div>
          )}
          
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm text-muted-foreground">
              By approving, you will reset the guard's approval requirement and allow them to login again.
              The guard will need to login from their designated location.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={onApprove}
            disabled={isLoading}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {isLoading ? "Approving..." : "Approve Login"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
