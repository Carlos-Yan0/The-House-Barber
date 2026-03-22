// src/pages/admin/AdminBarbersPage.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, UserCheck, Percent, Edit2, PowerOff, Power } from "lucide-react";
import { adminApi } from "@/lib/api";
import { Button, EmptyState, Spinner, Modal, Input, Badge } from "@/components/ui";

import type { User } from "@/types";
import toast from "react-hot-toast";

const EMPTY_FORM = { name: "", email: "", password: "", phone: "", commissionRate: 50 };

interface EditForm {
  name: string;
  email: string;
  phone: string;
  commissionRate: number;
}

export function AdminBarbersPage() {
  const qc = useQueryClient();

  // ── Modal criar ───────────────────────────────────────────────────────────
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);

  // ── Modal editar ──────────────────────────────────────────────────────────
  const [editModal, setEditModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", email: "", phone: "", commissionRate: 50,
  });

  // ── Modal confirmar inativação ────────────────────────────────────────────
  const [toggleModal, setToggleModal] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<{ id: string; name: string; isActive: boolean } | null>(null);

  const { data: barbers = [], isLoading } = useQuery({
    queryKey: ["admin-barbers"],
    queryFn: () => adminApi.listUsers("BARBER").then((r) => r.data as User[]),
  });

  // ── Mutações ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createBarber({ ...createForm, commissionRate: createForm.commissionRate / 100 }),
    onSuccess: () => {
      toast.success("Barbeiro criado!");
      qc.invalidateQueries({ queryKey: ["admin-barbers"] });
      setCreateModal(false);
      setCreateForm(EMPTY_FORM);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Erro ao criar"),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      adminApi.updateBarber(editingId!, {
        name:           editForm.name   || undefined,
        email:          editForm.email  || undefined,
        phone:          editForm.phone  || undefined,
        commissionRate: editForm.commissionRate / 100,
      }),
    onSuccess: () => {
      toast.success("Barbeiro atualizado!");
      qc.invalidateQueries({ queryKey: ["admin-barbers"] });
      setEditModal(false);
      setEditingId(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Erro ao atualizar"),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => adminApi.toggleUserActive(id),
    onSuccess: (_, id) => {
      const wasActive = toggleTarget?.isActive;
      toast.success(wasActive ? "Barbeiro inativado" : "Barbeiro reativado");
      qc.invalidateQueries({ queryKey: ["admin-barbers"] });
      setToggleModal(false);
      setToggleTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Erro ao atualizar status"),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openEdit = (barber: any) => {
    setEditingId(barber.id);
    setEditForm({
      name:           barber.name,
      email:          barber.email,
      phone:          barber.phone ?? "",
      commissionRate: Math.round((barber.barberProfile?.commissionRate ?? 0.5) * 100),
    });
    setEditModal(true);
  };

  const openToggle = (barber: any) => {
    setToggleTarget({ id: barber.id, name: barber.name, isActive: barber.isActive });
    setToggleModal(true);
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Barbeiros</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Gerencie a equipe da barbearia</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateModal(true)}>
          Novo barbeiro
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : barbers.length === 0 ? (
        <EmptyState
          icon={<UserCheck size={22} />}
          title="Nenhum barbeiro cadastrado"
          action={<Button size="sm" onClick={() => setCreateModal(true)}>Cadastrar barbeiro</Button>}
        />
      ) : (
        <div className="space-y-3">
          {(barbers as any[]).map((barber) => (
            <div key={barber.id} className={`card-elevated p-4 transition-all ${!barber.isActive && "opacity-50"}`}>
              <div className="flex items-start justify-between gap-3">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white text-sm">{barber.name}</p>
                    {!barber.isActive && <Badge variant="gray">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{barber.email}</p>
                  {barber.barberProfile && (
                    <div className="flex items-center gap-1 text-xs text-gold-400 mt-1.5">
                      <Percent size={11} />
                      {Math.round(barber.barberProfile.commissionRate * 100)}% de comissão
                    </div>
                  )}
                </div>

                {/* Ações — mesmo padrão da tela de serviços */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(barber)}
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-dark-50/60 transition-all"
                  >
                    <Edit2 size={15} />
                  </button>
                  {barber.isActive ? (
                    <button
                      onClick={() => openToggle(barber)}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <PowerOff size={15} />
                    </button>
                  ) : (
                    <button
                      onClick={() => openToggle(barber)}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                    >
                      <Power size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: criar barbeiro ── */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Novo barbeiro">
        <div className="space-y-4">
          <Input
            label="Nome completo"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            placeholder="Nome do barbeiro"
          />
          <Input
            label="E-mail"
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            placeholder="barbeiro@email.com"
          />
          <Input
            label="Senha inicial"
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            placeholder="Mínimo 8 caracteres"
          />
          <Input
            label="WhatsApp (opcional)"
            value={createForm.phone}
            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
            placeholder="47999999999"
          />
          <div>
            <label className="section-label block mb-1.5">
              Taxa de comissão: {createForm.commissionRate}%
            </label>
            <input
              type="range" min={20} max={80} step={5}
              value={createForm.commissionRate}
              onChange={(e) => setCreateForm({ ...createForm, commissionRate: Number(e.target.value) })}
              className="w-full accent-gold-500"
            />
            <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
              <span>20%</span><span>80%</span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setCreateModal(false)}>Cancelar</Button>
            <Button
              className="flex-1"
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
              disabled={!createForm.name || !createForm.email || createForm.password.length < 8}
            >
              Criar barbeiro
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: editar barbeiro ── */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Editar barbeiro">
        <div className="space-y-4">
          <Input
            label="Nome completo"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            placeholder="Nome do barbeiro"
          />
          <Input
            label="E-mail"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            placeholder="barbeiro@email.com"
          />
          <Input
            label="WhatsApp"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            placeholder="47999999999"
          />
          <div>
            <label className="section-label block mb-1.5">
              Taxa de comissão: {editForm.commissionRate}%
            </label>
            <input
              type="range" min={20} max={80} step={5}
              value={editForm.commissionRate}
              onChange={(e) => setEditForm({ ...editForm, commissionRate: Number(e.target.value) })}
              className="w-full accent-gold-500"
            />
            <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
              <span>20%</span><span>80%</span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setEditModal(false)}>Cancelar</Button>
            <Button
              className="flex-1"
              loading={editMutation.isPending}
              onClick={() => editMutation.mutate()}
              disabled={!editForm.name || !editForm.email}
            >
              Salvar alterações
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: confirmar toggle ativo/inativo ── */}
      <Modal
        isOpen={toggleModal}
        onClose={() => setToggleModal(false)}
        title={toggleTarget?.isActive ? "Inativar barbeiro" : "Reativar barbeiro"}
        size="sm"
      >
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          {toggleTarget?.isActive
            ? <>Tem certeza que deseja inativar <strong className="text-white">{toggleTarget?.name}</strong>? Ele não conseguirá fazer login e não aparecerá para agendamentos.</>
            : <>Deseja reativar <strong className="text-white">{toggleTarget?.name}</strong>? Ele voltará a aparecer para agendamentos.</>
          }
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setToggleModal(false)}>
            Cancelar
          </Button>
          <Button
            variant={toggleTarget?.isActive ? "danger" : "gold"}
            className="flex-1"
            loading={toggleMutation.isPending}
            onClick={() => toggleTarget && toggleMutation.mutate(toggleTarget.id)}
          >
            {toggleTarget?.isActive ? "Inativar" : "Reativar"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}