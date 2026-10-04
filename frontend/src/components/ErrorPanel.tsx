import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";

export function ErrorPanel({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <p>{errorMessage(error)}</p>
      {retry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={retry}>
          Повторить попытку
        </Button>
      )}
    </div>
  );
}
