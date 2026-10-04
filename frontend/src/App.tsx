import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  CircleHelp,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorPanel } from "@/components/ErrorPanel";
import { UserWorkspace } from "@/components/UserWorkspace";
import { client, unwrap } from "@/lib/api";

export default function App() {
  const [selected, setSelected] = useState<number | null>(null);
  const users = useQuery({
    queryKey: ["users"],
    queryFn: async ({ signal }) =>
      unwrap(await client.GET("/api/users", { signal })),
  });
  const products = useQuery({
    queryKey: ["products"],
    queryFn: async ({ signal }) =>
      unwrap(await client.GET("/api/products", { signal })),
  });
  const user = users.data?.find((u) => u.id === selected) ?? users.data?.[0];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col border-r border-[#2e3541] bg-[#1d232d] text-[#edf0f5] lg:flex">
        <Brand />
        <div className="px-6 pt-9 text-[10px] font-semibold tracking-[.16em] text-[#9ca7b8]">
          РАБОЧЕЕ ПРОСТРАНСТВО
        </div>
        <nav className="mt-4 px-3" aria-label="Главная навигация">
          <a
            href="#"
            aria-current="page"
            className="flex items-center gap-3 rounded-lg border border-[#55352f] bg-[#352923] px-4 py-3 text-[13px] font-semibold text-[#ff937f]"
          >
            <Ticket size={18} /> Ваучеры{" "}
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
          </a>
        </nav>
        <div className="mx-5 mt-auto mb-5 rounded-lg border border-[#343c48] bg-[#242c37] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <CircleHelp size={15} className="text-[#9ca7b8]" /> Как это работает
          </div>
          <p className="mt-2 text-xs leading-5 text-[#9ca7b8]">
            Один ваучер — одна активация продукта. Управляйте запасом в форме
            администратора.
          </p>
        </div>
        <div className="flex items-center gap-3 border-t border-[#343c48] px-6 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#333d4b]">
            <ShieldCheck size={16} />
          </span>
          <div>
            <p className="text-xs font-semibold">Демо-пространство</p>
            <p className="mt-0.5 text-[10px] text-[#9ca7b8]">
              Управление активациями
            </p>
          </div>
        </div>
      </aside>
      <div className="lg:pl-[232px]">
        <header className="flex h-[76px] items-center justify-between border-b bg-white px-5 sm:px-9">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Рабочее пространство</span>
            <ChevronRight className="hidden sm:block" size={13} />
            <span className="font-medium text-foreground">Ваучеры</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-[#fafbfc] px-3 py-1.5 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> TBM Tuning
            Platform
          </div>
        </header>
        <main className="mx-auto max-w-[1390px] px-5 py-8 sm:px-9 sm:py-9">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-2 text-[10px] font-semibold tracking-[.17em] text-primary">
                КОНТРОЛЬ АКТИВАЦИЙ
              </div>
              <h1 className="text-[29px] font-semibold tracking-[-.035em] sm:text-[32px]">
                Управление ваучерами
              </h1>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Все продукты, доступные активации и история — в одном месте.
              </p>
            </div>
            <span className="mt-2 flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck size={13} /> Панель управления
            </span>
          </div>
          {users.isError || products.isError ? (
            <ErrorPanel
              error={users.error ?? products.error}
              retry={() => {
                void users.refetch();
                void products.refetch();
              }}
            />
          ) : !users.data || !products.data ? (
            <div
              aria-label="Загрузка пользователей и продуктов"
              className="space-y-5"
            >
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : !user ? (
            <div className="card p-8 text-sm">Пользователей пока нет.</div>
          ) : (
            <>
              <section
                className="card mb-7 flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                aria-label="Выбор пользователя"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0f2f6] text-muted-foreground">
                    <Users size={21} />
                  </div>
                  <div>
                    <label
                      htmlFor="user-select"
                      className="text-[13px] font-semibold"
                    >
                      Текущий пользователь
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Выберите, чьими ваучерами управлять
                    </p>
                  </div>
                </div>
                <div className="w-full sm:w-[300px]">
                  <select
                    id="user-select"
                    className="field"
                    value={user.id}
                    onChange={(e) => setSelected(Number(e.target.value))}
                  >
                    {users.data.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </section>
              <UserWorkspace
                key={user.id}
                user={user}
                products={products.data}
              />
            </>
          )}
          <footer className="mt-9 flex flex-wrap justify-between gap-2 border-t pt-5 text-[10px] text-muted-foreground">
            <span>TBM Tuning · Voucher Management</span>
            <span>Точность в каждой активации.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Brand() {
  return (
    <div className="flex h-[76px] items-center gap-2.5 border-b border-[#343c48] px-6">
      <div className="flex h-8 w-8 -skew-x-6 items-center justify-center rounded-md bg-primary font-black italic text-white">
        T
      </div>
      <span className="text-xl font-extrabold italic tracking-[-.05em]">
        TBM
        <span className="ml-1.5 text-[10px] font-semibold not-italic tracking-[.13em] text-muted-foreground">
          TUNING
        </span>
      </span>
    </div>
  );
}
