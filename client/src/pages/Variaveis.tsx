import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Variaveis() {
  const utils = trpc.useUtils();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    descricao: "",
    valor: "",
    tipo: "credito" as "credito" | "debito",
    observacoes: "",
  });

  const { data: variaveis, isLoading } = trpc.variaveis.list.useQuery();

  const createMutation = trpc.variaveis.create.useMutation({
    onSuccess: () => {
      utils.variaveis.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Variável criada com sucesso!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar variável: " + error.message);
    },
  });

  const updateMutation = trpc.variaveis.update.useMutation({
    onSuccess: () => {
      utils.variaveis.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Variável atualizada!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  const deleteMutation = trpc.variaveis.delete.useMutation({
    onSuccess: () => {
      utils.variaveis.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Variável excluída!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      data: new Date().toISOString().split('T')[0],
      descricao: "",
      valor: "",
      tipo: "credito",
      observacoes: "",
    });
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      data: new Date(formData.data),
      descricao: formData.descricao,
      valor: parseCurrency(formData.valor),
      tipo: formData.tipo,
      observacoes: formData.observacoes || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (variavel: any) => {
    setEditingId(variavel.id);
    setFormData({
      data: new Date(variavel.data).toISOString().split('T')[0],
      descricao: variavel.descricao,
      valor: (variavel.valor / 100).toFixed(2),
      tipo: variavel.tipo,
      observacoes: variavel.observacoes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta variável?")) {
      deleteMutation.mutate({ id });
    }
  };

  const filteredVariaveis = variaveis?.filter(v => 
    v.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalCredito = filteredVariaveis
    .filter(v => v.tipo === "credito")
    .reduce((sum, v) => sum + v.valor, 0);

  const totalDebito = filteredVariaveis
    .filter(v => v.tipo === "debito")
    .reduce((sum, v) => sum + v.valor, 0);

  const saldo = totalCredito - totalDebito;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Variáveis Financeiras</h1>
            <p className="text-muted-foreground mt-1">
              Controle valores adicionais e variáveis
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Variável
          </Button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Crédito</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(totalCredito)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Débito</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(totalDebito)}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo</p>
                  <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(saldo)}
                  </p>
                </div>
                <TrendingUp className={`h-8 w-8 ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição..."
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
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Observações</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : filteredVariaveis.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma variável encontrada</p>
                      </td>
                    </tr>
                  ) : (
                    filteredVariaveis.map((v) => (
                      <tr key={v.id} className="animate-fade-in">
                        <td>{formatDate(new Date(v.data))}</td>
                        <td className="font-medium">{v.descricao}</td>
                        <td>
                          {v.tipo === "credito" ? (
                            <span className="badge badge-success">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Crédito
                            </span>
                          ) : (
                            <span className="badge badge-error">
                              <TrendingDown className="h-3 w-3 mr-1" />
                              Débito
                            </span>
                          )}
                        </td>
                        <td className={v.tipo === "credito" ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(v.valor)}
                        </td>
                        <td className="max-w-xs truncate">{v.observacoes || "-"}</td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(v)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(v.id)}
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
                {editingId ? "Editar Variável" : "Nova Variável"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da variável financeira
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="data">Data</Label>
                  <Input
                    id="data"
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Input
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo</Label>
                    <Select
                      value={formData.tipo}
                      onValueChange={(value: "credito" | "debito") => 
                        setFormData({ ...formData, tipo: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credito">Crédito</SelectItem>
                        <SelectItem value="debito">Débito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valor">Valor (R$)</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
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
