import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate, parseCurrency } from "@/const";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  CheckCircle,
  XCircle,
  Loader2,
  FileText
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Lancamentos() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    dataEmissao: new Date().toISOString().split('T')[0],
    cliente: "",
    numeroNf: "",
    os: "",
    descricao: "",
    valorTotal: "",
    taxaComissao: "0.5",
    observacoes: "",
  });

  const { data: lancamentos, isLoading } = trpc.lancamentos.list.useQuery();

  const createMutation = trpc.lancamentos.create.useMutation({
    onSuccess: () => {
      utils.lancamentos.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Lançamento criado com sucesso!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar lançamento: " + error.message);
    },
  });

  const updateMutation = trpc.lancamentos.update.useMutation({
    onSuccess: () => {
      utils.lancamentos.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Lançamento atualizado!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  const deleteMutation = trpc.lancamentos.delete.useMutation({
    onSuccess: () => {
      utils.lancamentos.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Lançamento excluído!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });

  const toggleFaturadoMutation = trpc.lancamentos.toggleFaturado.useMutation({
    onSuccess: () => {
      utils.lancamentos.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Status atualizado!");
    },
  });

  const resetForm = () => {
    setFormData({
      dataEmissao: new Date().toISOString().split('T')[0],
      cliente: "",
      numeroNf: "",
      os: "",
      descricao: "",
      valorTotal: "",
      taxaComissao: "0.5",
      observacoes: "",
    });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      dataEmissao: new Date(formData.dataEmissao),
      cliente: formData.cliente,
      numeroNf: formData.numeroNf || undefined,
      os: formData.os || undefined,
      descricao: formData.descricao || undefined,
      valorTotal: parseCurrency(formData.valorTotal),
      taxaComissao: Math.round(parseFloat(formData.taxaComissao) * 100),
      observacoes: formData.observacoes || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (lancamento: any) => {
    setEditingId(lancamento.id);
    setFormData({
      dataEmissao: new Date(lancamento.dataEmissao).toISOString().split('T')[0],
      cliente: lancamento.cliente,
      numeroNf: lancamento.numeroNf || "",
      os: lancamento.os || "",
      descricao: lancamento.descricao || "",
      valorTotal: (lancamento.valorTotal / 100).toFixed(2),
      taxaComissao: (lancamento.taxaComissao / 100).toFixed(2),
      observacoes: lancamento.observacoes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir este lançamento?")) {
      deleteMutation.mutate({ id });
    }
  };

  const filteredLancamentos = lancamentos?.filter(l => 
    l.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.numeroNf?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.os?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Lançamentos Financeiros</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie seus lançamentos e notas fiscais
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Lançamento
          </Button>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, NF ou OS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>NF</th>
                    <th>OS/PC</th>
                    <th>Valor Total</th>
                    <th>Comissão</th>
                    <th>Status</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : filteredLancamentos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum lançamento encontrado</p>
                      </td>
                    </tr>
                  ) : (
                    filteredLancamentos.map((l) => (
                      <tr key={l.id} className="animate-fade-in">
                        <td>{formatDate(new Date(l.dataEmissao))}</td>
                        <td className="font-medium">{l.cliente}</td>
                        <td>{l.numeroNf || "NT"}</td>
                        <td>{l.os || "-"}</td>
                        <td>{formatCurrency(l.valorTotal)}</td>
                        <td>{formatCurrency(l.comissao)}</td>
                        <td>
                          <button
                            onClick={() => toggleFaturadoMutation.mutate({ 
                              id: l.id, 
                              faturado: !l.faturado 
                            })}
                            className="flex items-center gap-1"
                          >
                            {l.faturado ? (
                              <span className="badge badge-success">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Faturado
                              </span>
                            ) : (
                              <span className="badge badge-warning">
                                <XCircle className="h-3 w-3 mr-1" />
                                Pendente
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(l)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(l.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Dialog de Formulário */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Lançamento" : "Novo Lançamento"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados do lançamento financeiro
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataEmissao">Data de Emissão</Label>
                    <Input
                      id="dataEmissao"
                      type="date"
                      value={formData.dataEmissao}
                      onChange={(e) => setFormData({ ...formData, dataEmissao: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cliente">Cliente</Label>
                    <Input
                      id="cliente"
                      value={formData.cliente}
                      onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numeroNf">Número NF</Label>
                    <Input
                      id="numeroNf"
                      value={formData.numeroNf}
                      onChange={(e) => setFormData({ ...formData, numeroNf: e.target.value })}
                      placeholder="Deixe vazio para NT"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="os">OS / PC</Label>
                    <Input
                      id="os"
                      value={formData.os}
                      onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Input
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="valorTotal">Valor Total (R$)</Label>
                    <Input
                      id="valorTotal"
                      type="number"
                      step="0.01"
                      value={formData.valorTotal}
                      onChange={(e) => setFormData({ ...formData, valorTotal: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxaComissao">Taxa Comissão (%)</Label>
                    <Input
                      id="taxaComissao"
                      type="number"
                      step="0.01"
                      value={formData.taxaComissao}
                      onChange={(e) => setFormData({ ...formData, taxaComissao: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Input
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingId ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
