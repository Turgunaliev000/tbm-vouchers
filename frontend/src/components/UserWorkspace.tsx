import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gauge,
  History,
  Layers3,
  Loader2,
  Settings2,
  Ticket,
  Wrench,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorPanel } from "@/components/ErrorPanel";
import { AdminForm } from "@/components/AdminForm";
import { client, unwrap, type Product, type User } from "@/lib/api";

const icons = [Gauge, Zap, Settings2, Wrench];
const pageSize = 5;
const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function UserWorkspace({
  user,
  products,
}: {
  user: User;
  products: Product[];
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const balances = useQuery({
    queryKey: ["balances", user.id],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/users/{user_id}/balances", {
          params: { path: { user_id: user.id } },
          signal,
        }),
      ),
  });
  const history = useQuery({
    queryKey: ["history", user.id, page],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/users/{user_id}/activations", {
          params: {
            path: { user_id: user.id },
            query: { limit: pageSize, offset: page * pageSize },
          },
          signal,
        }),
      ),
  });
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["balances", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["history", user.id] }),
    ]);
  }
  const activation = useMutation({
    mutationFn: async (product_id: number) =>
      unwrap(
        await client.POST("/api/users/{user_id}/activations/{product_id}", {
          params: { path: { user_id: user.id, product_id } },
        }),
      ),
    onMutate: () => setNotice(""),
    onSuccess: async (data) => {
      setNotice(
        `${data.product_name}: ваучер активирован. Запись добавлена в историю.`,
      );
      setPage(0);
      await refresh();
    },
    onError: async () => {
      await refresh();
    },
  });
  const total = balances.data?.reduce((sum, b) => sum + b.quantity, 0);
  const available = balances.data?.filter((b) => b.quantity > 0).length;
  return (
    <div className="page-enter">
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Доступно ваучеров",
            value: total,
            icon: Ticket,
            note: "Готовы к активации",
            color: "text-primary bg-[#fff0eb]",
          },
          {
            label: "Продуктов с запасом",
            value: available,
            icon: Layers3,
            note: `Из ${products.length} продуктов в каталоге`,
            color: "text-[#5678b8] bg-[#eef3fc]",
          },
          {
            label: "Всего активаций",
            value: history.data?.total,
            icon: Activity,
            note: "За всё время",
            color: "text-[#388773] bg-[#eaf5f0]",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="card flex items-start justify-between p-5"
          >
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <div className="my-2 text-[30px] font-semibold leading-10 tracking-tight">
                {item.value === undefined ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  item.value.toLocaleString("ru-RU")
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">{item.note}</p>
            </div>
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.color}`}
            >
              <item.icon size={18} />
            </span>
          </div>
        ))}
      </div>
      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">
              Продукты и ваучеры{" "}
              <span className="ml-1.5 rounded-md bg-[#eaedf1] px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {products.length}
              </span>
            </h2>
            <span className="text-[11px] text-muted-foreground">
              1 ваучер = 1 активация
            </span>
          </div>
          {notice && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800"
            >
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              {notice}
            </div>
          )}
          {activation.isError && (
            <div className="mb-4">
              <ErrorPanel error={activation.error} />
            </div>
          )}
          {balances.isError ? (
            <ErrorPanel
              error={balances.error}
              retry={() => void balances.refetch()}
            />
          ) : !balances.data ? (
            <div
              aria-label="Загрузка ваучеров"
              className="grid gap-4 sm:grid-cols-2"
            >
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-56 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {products.map((product, index) => {
                const quantity =
                  balances.data.find((b) => b.product_id === product.id)
                    ?.quantity ?? 0;
                const Icon = icons[index % icons.length];
                const busy =
                  activation.isPending && activation.variables === product.id;
                return (
                  <article
                    key={product.id}
                    className="card product-card flex flex-col p-5"
                    aria-label={product.name}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg border bg-[#fafbfc] text-[#535e6e]">
                        <Icon size={21} strokeWidth={1.6} />
                      </span>
                      <span className="text-[8px] font-semibold tracking-[.13em] text-muted-foreground">
                        {product.category}
                      </span>
                    </div>
                    <h3 className="text-[17px] font-semibold tracking-tight">
                      {product.name}
                    </h3>
                    <p className="mt-1.5 mb-5 min-h-9 text-[11px] leading-[1.7] text-muted-foreground">
                      {product.description}
                    </p>
                    <div className="mt-auto flex items-end justify-between border-t pt-4">
                      <div>
                        <div className="mb-1 text-[10px] text-muted-foreground">
                          Остаток ваучеров
                        </div>
                        <span
                          className={`text-2xl font-semibold ${quantity === 0 ? "text-muted-foreground" : ""}`}
                        >
                          {quantity.toLocaleString("ru-RU")}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`mb-1 gap-1 border-0 px-2 text-[9px] font-medium ${quantity > 0 ? "bg-[#edf7f1] text-[#36855d]" : "bg-[#f3f4f6] text-muted-foreground"}`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full ${quantity > 0 ? "bg-[#36855d]" : "bg-slate-400"}`}
                        />
                        {quantity > 0 ? "Доступно" : "Нет ваучеров"}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => activation.mutate(product.id)}
                      disabled={
                        quantity === 0 ||
                        activation.isPending ||
                        balances.isFetching
                      }
                      className="mt-4 h-9 w-full text-xs shadow-none"
                    >
                      {busy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : quantity > 0 ? (
                        <Zap size={13} />
                      ) : (
                        <Ticket size={13} />
                      )}{" "}
                      {busy
                        ? "Активация…"
                        : quantity > 0
                          ? "Активировать"
                          : "Ваучеры закончились"}
                      {quantity > 0 && !busy && (
                        <ArrowUpRight size={13} className="ml-auto" />
                      )}
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
          <section className="mt-8" aria-labelledby="history-title">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="history-title" className="text-base font-semibold">
                История активаций
              </h2>
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Clock3 size={12} /> Местное время
              </span>
            </div>
            <div className="card overflow-hidden">
              {history.isError ? (
                <div className="p-4">
                  <ErrorPanel
                    error={history.error}
                    retry={() => void history.refetch()}
                  />
                </div>
              ) : !history.data ? (
                <div aria-label="Загрузка истории" className="space-y-3 p-5">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : history.data.total === 0 ? (
                <div className="flex flex-col items-center px-4 py-10 text-center">
                  <span className="mb-3 rounded-full bg-[#f3f5f8] p-3 text-muted-foreground">
                    <History size={20} />
                  </span>
                  <p className="text-sm font-medium">Пока нет активаций</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Активируйте первый ваучер — он появится здесь.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b bg-[#fafbfc] text-[10px] text-muted-foreground">
                        <tr>
                          <th className="px-3 py-3 font-medium sm:px-5">
                            Продукт
                          </th>
                          <th className="px-4 py-3 font-medium">
                            Дата и время
                          </th>
                          <th className="px-3 py-3 font-medium sm:px-5">
                            Статус
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.data.items.map((item) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="whitespace-nowrap px-3 py-4 font-medium sm:px-5">
                              <span className="mr-2 inline-flex rounded-md bg-[#f4f5f7] p-1.5 align-middle text-muted-foreground">
                                <ArrowDownLeft size={13} />
                              </span>
                              {item.product_name}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-[10px] text-muted-foreground">
                              {dateFormat.format(new Date(item.activated_at))}
                            </td>
                            <td className="px-3 py-4 sm:px-5">
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#39865e]">
                                <Check size={12} />
                                <span className="sr-only sm:not-sr-only">
                                  Активирован
                                </span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t px-5 py-3">
                    <span className="text-[10px] text-muted-foreground">
                      {page * pageSize + 1}–
                      {Math.min((page + 1) * pageSize, history.data.total)} из{" "}
                      {history.data.total}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Предыдущая страница"
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft size={13} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Следующая страница"
                        disabled={(page + 1) * pageSize >= history.data.total}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        <ChevronRight size={13} />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
        <AdminForm user={user} products={products} refresh={refresh} />
      </div>
    </div>
  );
}
