import { useEffect, useState } from 'react';
import { localApi } from '../services/api';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ConfigLocal() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    localApi.get()
      .then(r => setConfig(r.data))
      .catch(() => toast.error('Error al cargar'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try { await localApi.update(config); toast.success('Guardado'); }
    catch { toast.error('Error al guardar'); }
    finally { setGuardando(false); }
  };

  const f = (label: string, key: string, type = 'text') => (
    <div key={key}>
      <label className="text-xs text-gray-600 mb-1 block">{label}</label>
      <input type={type} value={config?.[key] || ''} onChange={e => setConfig({...config, [key]: e.target.value})}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
    </div>
  );

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">Configuracion del Local</h1>
      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-semibold mb-4">Datos del Negocio</h3>
          <div className="grid grid-cols-3 gap-4">
            {f('Nombre','nombre')}{f('Slogan','slogan')}{f('Telefono','telefono','tel')}
            {f('WhatsApp','whatsapp','tel')}{f('Email','email','email')}{f('Email notif.','email_notif','email')}
            {f('Horario','horario')}{f('Direccion Salida','dir_salida')}
            <div><label className="text-xs text-gray-600 mb-1 block">Tipo Servicio</label>
              <select value={config?.tipo_servicio||'local_y_delivery'} onChange={e => setConfig({...config,tipo_servicio:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="local_y_delivery">Local y Delivery</option>
                <option value="solo_local">Solo Local</option>
                <option value="solo_delivery">Solo Delivery</option>
              </select></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-semibold mb-4">Tarifas</h3>
          <div className="grid grid-cols-4 gap-4">
            {f('Min. Delivery ($)','min_delivery','number')}{f('Min. Local ($)','min_local','number')}
            {f('Mins por Punto','mins_x_punto','number')}{f('Valor Dolar','valor_dolar','number')}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-semibold mb-4">Cuenta Bancaria</h3>
          <div className="grid grid-cols-3 gap-4">
            {f('RUT Titular','rut_titular')}{f('Razon Social','razon_social')}{f('ID Fiscal','id_fiscal')}
            {f('Banco','banco')}
            <div><label className="text-xs text-gray-600 mb-1 block">Tipo Cuenta</label>
              <select value={config?.tipo_cuenta||'CUENTA CORRIENTE'} onChange={e => setConfig({...config,tipo_cuenta:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option>CUENTA CORRIENTE</option><option>CUENTA VISTA</option><option>CUENTA DE AHORRO</option>
              </select></div>
            {f('Nro. Cuenta','nro_cuenta')}{f('Titular','titular_cta')}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-semibold mb-4">Opciones</h3>
          <div className="flex gap-6">
            {[['Envio correos','envio_correos'],['Boton pagar','boton_pagar'],['Autopistas','autopistas']].map(([label,key]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config?.[key]||false} onChange={e => setConfig({...config,[key]:e.target.checked})} className="rounded text-blue-600 w-4 h-4" />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={guardando}
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
            <Save size={16} />{guardando ? 'Guardando...' : 'Guardar Configuracion'}
          </button>
        </div>
      </form>
    </div>
  );
}
