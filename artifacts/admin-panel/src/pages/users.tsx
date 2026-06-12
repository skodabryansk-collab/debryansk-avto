import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, createUser, updateUser, deleteUser, type User } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, UserCheck, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function UsersPage() {
  const [editItem, setEditItem] = React.useState<User | null>(null);
  const [isCreate, setIsCreate] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const qc = useQueryClient();
  const { toast } = useToast();

  const delMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      setDeleteId(null);
      toast({ title: "Пользователь удалён" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateUser(id, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Статус обновлён" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Пользователи</h1>
        <Button size="sm" className="bg-[#0070b8] hover:bg-[#005a94]" onClick={() => setIsCreate(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Добавить
        </Button>
      </div>
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Почта</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-32">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">Загрузка...</TableCell></TableRow>
              ) : !data?.length ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">Пользователей не найдено</TableCell></TableRow>
              ) : data.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.fullName}</TableCell>
                  <TableCell className="text-sm text-slate-600">{u.email}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={u.isActive ? "text-emerald-600" : "text-slate-400"}
                      onClick={() => toggleMutation.mutate({ id: u.id, isActive: !u.isActive })}
                      disabled={toggleMutation.isPending}
                    >
                      {u.isActive ? (
                        <><UserCheck className="w-4 h-4 mr-1" />Активен</>
                      ) : (
                        <><UserX className="w-4 h-4 mr-1" />Отключен</>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setEditItem(u)}>
                        <Pencil className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setDeleteId(u.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить пользователя?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Отмена</Button>
            <Button variant="destructive" onClick={() => deleteId && delMutation.mutate(deleteId)} disabled={delMutation.isPending}>
              {delMutation.isPending ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Create */}
      {(editItem || isCreate) && (
        <UserFormDialog item={editItem} onClose={() => { setEditItem(null); setIsCreate(false); }} />
      )}
    </div>
  );
}

function UserFormDialog({ item, onClose }: { item: User | null; onClose: () => void }) {
  const [form, setForm] = React.useState({
    fullName: item?.fullName ?? "",
    email: item?.email ?? "",
    password: "",
    isActive: item?.isActive ?? true,
    isAdmin: item?.isAdmin ?? false,
  });
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!item;

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const payload: Partial<typeof form> = { ...form };
        if (!payload.password) delete payload.password;
        return updateUser(item!.id, payload);
      }
      return createUser({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        isActive: form.isActive,
        isAdmin: form.isAdmin,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
      toast({ title: isEdit ? "Пользователь обновлён" : "Пользователь создан" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать" : "Новый пользователь"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>ФИО</Label><Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} /></div>
          <div><Label>Почта (логин)</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div>
            <Label>Пароль{isEdit && <span className="text-slate-400 text-xs ml-1">(оставьте пустым, чтобы не менять)</span>}</Label>
            <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="isActive" checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: !!v }))} />
            <label htmlFor="isActive" className="text-sm cursor-pointer">Активен</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="isAdmin" checked={form.isAdmin} onCheckedChange={v => setForm(f => ({ ...f, isAdmin: !!v }))} />
            <label htmlFor="isAdmin" className="text-sm cursor-pointer">Администратор</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button className="bg-[#0070b8] hover:bg-[#005a94]" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Сохранение..." : isEdit ? "Сохранить" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
