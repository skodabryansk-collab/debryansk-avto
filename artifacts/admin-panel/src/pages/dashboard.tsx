import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getStats } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, Phone, MapPin, Clock, Tag, Users } from "lucide-react";

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["stats"], queryFn: getStats });

  const stats = [
    { label: "Новостей", value: data?.news ?? 0, icon: Newspaper, color: "bg-[#0070b8]/10 text-[#0070b8]" },
    { label: "Заявок всего", value: data?.leads ?? 0, icon: Phone, color: "bg-emerald-50 text-emerald-600" },
    { label: "Заявок сегодня", value: data?.leadsToday ?? 0, icon: Clock, color: "bg-amber-50 text-amber-600" },
    { label: "Дилеров", value: data?.dealers ?? 0, icon: MapPin, color: "bg-violet-50 text-violet-600" },
    { label: "Брендов", value: data?.brands ?? 0, icon: Tag, color: "bg-rose-50 text-rose-600" },
    { label: "Пользователей", value: data?.users ?? 0, icon: Users, color: "bg-sky-50 text-sky-600" },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Дашборд</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">{label}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {isLoading ? <span className="inline-block w-8 h-6 bg-slate-100 rounded animate-pulse" /> : value}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
