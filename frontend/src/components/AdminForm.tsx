import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Settings2,
  ShieldCheck,
  CircleHelp,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorPanel } from "@/components/ErrorPanel";
import { client, unwrap, type Product, type User } from "@/lib/api";

export function AdminForm({
  user,
  products,
  refresh,
}: {
  user: User;
  products: Product[];
  refresh: () => Promise<void>;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? 0);
  const [quantity, setQuantity] = useState("");
  const [validation, setValidation] = useState("");
  const mutation = useMutation({
    mutationFn: async (input: { productId: number; quantity: number }) =>
      unwrap(
        await client.PUT("/api/users/{user_id}/balances/{product_id}", {
          params: { path: { user_id: user.id, product_id: input.productId } },
          body: { quantity: input.quantity },
        }),
      ),
    onSuccess: async () => {
      await refresh();
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.reset();
    if (!/^\d+$/.test(quantity) || Number(quantity) > 1_000_000) {
      setValidation("Укажите целое число от 0 до 1 000 000.");
      return;
    }
    setValidation("");
    mutation.mutate({ productId, quantity: Number(quantity) });
  }
  return (
    <aside className="card mt-0 xl:mt-10">
      <div className="border-b p-5">
        <span className="mb-3 inline-flex rounded-lg bg-[#f1f3f7] p-2 text-[#626d7c]">
          <Settings2 size={19} />
        </span>
        <h2 className="text-[15px] font-semibold">Управление запасом</h2>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          Задайте количество ваучеров для выбранного пользователя.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4 p-5" noValidate>
        <div>
          <p className="mb-2 text-xs font-medium">Пользователь</p>
          <div className="flex items-center gap-2.5 rounded-md border bg-[#fafbfc] p-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e9edf5] text-[9px] font-semibold text-[#6c7890]">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium">{user.name}</p>
              <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
        </div>
        <div>
          <label
            htmlFor="product-select"
            className="mb-2 block text-xs font-medium"
          >
            Продукт
          </label>
          <select
            id="product-select"
            className="field"
            value={productId}
            disabled={mutation.isPending}
            onChange={(e) => {
              setProductId(Number(e.target.value));
              mutation.reset();
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="quantity" className="mb-2 block text-xs font-medium">
            Количество ваучеров
          </label>
          <Input
            id="quantity"
            type="number"
            min="0"
            max="1000000"
            step="1"
            placeholder="Например, 10"
            value={quantity}
            disabled={mutation.isPending}
            aria-invalid={!!validation}
            aria-describedby="quantity-help"
            onChange={(e) => {
              setQuantity(e.target.value);
              setValidation("");
              mutation.reset();
            }}
            className="h-[42px] text-xs shadow-none"
          />
          <p
            id="quantity-help"
            className="mt-2 text-[10px] text-muted-foreground"
          >
            Целое число от 0 до 1 000 000
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-[#fff8ee] px-3 py-3 text-[10px] leading-[1.7] text-[#967246]">
          <CircleHelp size={14} className="mt-0.5 shrink-0" />
          <p>
            Новое значение <strong className="font-semibold">заменит</strong>{" "}
            текущий запас, а не добавится к нему.
          </p>
        </div>
        {validation && (
          <p role="alert" className="text-xs text-red-700">
            {validation}
          </p>
        )}
        {mutation.isError && <ErrorPanel error={mutation.error} />}
        {mutation.isSuccess && (
          <p role="status" className="text-xs leading-5 text-emerald-700">
            Запас сохранён: {mutation.data.quantity.toLocaleString("ru-RU")}{" "}
            ваучеров.
          </p>
        )}
        <Button
          type="submit"
          disabled={mutation.isPending || !products.length}
          variant="secondary"
          className="h-10 w-full bg-[#242b36] text-xs text-white hover:bg-[#343e4e]"
        >
          {mutation.isPending ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <Check size={14} />
          )}{" "}
          {mutation.isPending ? "Сохранение…" : "Сохранить запас"}
        </Button>
      </form>
      <div className="flex items-center gap-2 border-t px-5 py-3 text-[9px] text-muted-foreground">
        <ShieldCheck size={12} /> Форма администратора
      </div>
    </aside>
  );
}
