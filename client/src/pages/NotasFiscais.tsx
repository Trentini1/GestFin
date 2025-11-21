import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Loader2,
  FileText,
  Upload
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function NotasFiscais() {
  const utils = trpc.useUtils();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    dataEmissao: new Date().toISOString().split('T')[0],
    fornecedor: "",
    numeroNf: "",
    osId: "",
    valorTotal: "",
    descricao: "",
    observacoes: "",
  });

  const { data: notas, isLoading } = trpc.notasCompra.list.useQuery();

  const createMutation = trpc.notasCompra.create.useMutation({
    onSuccess: () => {
      utils.notasCompra.list.invalidate();
      toast.success("Nota fiscal criada com sucesso!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar nota: " + error.message);
    },
  });

  const updateMutation = trpc.notasCompra.update.useMutation({
    onSuccess: () => {
      utils.notasCompra.list.invalidate();
      toast.success("Nota fiscal atualizada!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  const deleteMutation = trpc.notasCompra.delete.useMutation({
    onSuccess: () => {
      utils.notasCompra.list.invalidate();
      toast.success("Nota fiscal excluída!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      dataEmissao: new Date().toISOString().split('T')[0],
      fornecedor: "",
      numeroNf: "",
      osId: "",
      valorTotal: "",
      descricao: "",
      observacoes: "",
    });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      dataEmissao: new Date(formData.dataEmissao),
      fornecedor: formData.fornecedor,
      numeroNf: formData.numeroNf || undefined,
      osId: formData.osId || undefined,
      valorTotal: parseCurrency(formData.valorTotal),
      descricao: formData.descricao || undefined,
      observacoes: formData.observacoes || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (nota: any) => {
    setEditingId(nota.id);
    setFormData({
      dataEmissao: new Date(nota.dataEmissao).toISOString().split('T')[0],
      fornecedor: nota.fornecedor,
      numeroNf: nota.numeroNf || "",
      osId: nota.osId || "",
      valorTotal: (nota.valorTotal / 100).toFixed(2),
      descricao: nota.descricao || "",
      observacoes: nota.observacoes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta nota fiscal?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleUpload = () => {
    toast.info("Funcionalidade de upload com IA será implementada em breve!");
  };

  const filteredNotas = notas?.filter(n => 
    n.fornecedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.numeroNf?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.osId?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Notas Fiscais de Compra</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie notas fiscais e custos
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleUpload}>
              <Upload className="mr-2 h-4 w-4" />
              Analisar com IA
            </Button>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Nota
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por fornecedor, NF ou OS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Fornecedor</th>
                    <th>NF</th>
                    <th>OS</th>
                    <th>Valor</th>
                    <th>Descrição</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : filteredNotas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma nota fiscal encontrada</p>
                      </td>
                    </tr>
                  ) : (
                    filteredNotas.map((n) => (
                      <tr key={n.id} className="animate-fade-in">
                        <td>{formatDate(new Date(n.dataEmissao))}</td>
                        <td className="font-medium">{n.fornecedor}</td>
                        <td>{n.numeroNf || "-"}</td>
                        <td>{n.osId || "-"}</td>
                        <td>{formatCurrency(n.valorTotal)}</td>
                        <td className="max-w-xs truncate">{n.descricao || "-"}</td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(n)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(n.id)}
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Nota Fiscal" : "Nova Nota Fiscal"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da nota fiscal de compra
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
                    <Label htmlFor="fornecedor">Fornecedor</Label>
                    <Input
                      id="fornecedor"
                      value={formData.fornecedor}
                      onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="osId">OS Associada</Label>
                    <Input
                      id="osId"
                      value={formData.osId}
                      onChange={(e) => setFormData({ ...formData, osId: e.target.value })}
                    />
                  </div>
                </div>

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
                  <Label htmlFor="descricao">Descrição</Label>
                  <Input
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  />
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
