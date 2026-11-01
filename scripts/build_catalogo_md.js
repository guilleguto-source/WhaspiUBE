const fs = require('fs');
const path = require('path');

const data = require('../wa-bot/data/ube_catalogo_web_con_perfiles.json');

let md = '# Catálogo Maestro Oficial de Carreras y Programas - UBE\n\n';
md += '> Documento de referencia con la oferta académica completa de la Universidad Bolivariana del Ecuador (UBE), aranceles oficiales, perfiles de egreso, requisitos de admisión y programas especiales de validación laboral.\n\n---\n\n';

// 1. CONDICIONES GENERALES Y FINANCIERAS
md += '## 1. Condiciones Generales y Estructura Financiera\n\n';
md += '### Modalidades y Horarios:\n';
md += '- **Grado Regular (Licenciaturas e Ingenierías):** 100% Online nocturno (clases en vivo grabadas en plataforma) y Semipresencial (campus Durán).\n';
md += '- **Maestrías Online:** 100% Online. Solo 5 horas a la semana (Sábados intensivo 08h00-13h00 o 13h00-18h00, o Martes y Jueves nocturno 19h00-21h30).\n';
md += '- **Validación por Experiencia Laboral (PE-12 / PE-15):** Modalidad online diseñada para profesionales y personas en ejercicio que trabajan.\n\n';

md += '### Aranceles y Cuotas Oficiales:\n';
md += '| Nivel / Programa | Inscripción | PRE / Nivelación | Matrícula | Cuotas Mensuales | Duración Total |\n';
md += '|---|---|---|---|---|---|\n';
md += '| **Grado Regular (Educación)** | $100 | $150 (6 semanas) | $65 | 12x$140 (pronto pago) o $160 regular | 4 años (8 semestres) |\n';
md += '| **Grado Regular (Otras Carreras)** | $100 | $150 (6 semanas) | $100 | 12x$160 a $180 | 4 años (8 semestres) |\n';
md += '| **PE-12 Validación (Normalistas)** | Exonerada | Exonerado | Incluida | 12 cuotas fijas de $150 ($1.800 total) | 12 meses |\n';
md += '| **PE-15 Validación (4 años exp.)** | Exonerada | Exonerado | Incluida | 15 cuotas fijas de $150 ($2.250 total) | 15 meses |\n';
md += '| **Maestrías en Educación** | Exonerada | Exonerado | Incluida | 12x$125-$135 o 18x$83-$90 ($1.650-$1.730 total) | 12 meses |\n';
md += '| **Maestrías Tecnología / MBA / Derecho** | Exonerada | Exonerado | Incluida | 12x$166-$200 o 18x$111-$133 ($2.000-$2.400 total) | 12 meses |\n\n';

md += '### Políticas de Descuentos:\n';
md += '- **Pronto pago:** Descuento pagando hasta 72 horas antes de cada vencimiento.\n';
md += '- **Pago anticipado:** 5% de descuento por nivel/semestre completo.\n';
md += '- **Pago al contado:** 10% de descuento sobre el valor total del arancel.\n';
md += '- **Financiamiento:** Directo con la UBE sin intereses.\n\n---\n\n';

// 2. CARRERAS DE GRADO (16)
md += '## 2. Carreras de Grado Regular (16 Programas - 4 Años / 8 Semestres)\n\n';
const grados = data.filter(d => !d.titulo.toLowerCase().includes('maestría') && !d.titulo.toLowerCase().includes('master'));
grados.forEach((g, idx) => {
  const num = idx + 1;
  const area = g.area || (g.categoria ? g.categoria.replace(/^\d+_/, '').replace(/_/g, ' ') : 'General');
  md += `### 2.${num} ${g.titulo}\n`;
  md += `- **Facultad / Área:** ${area}\n`;
  md += `- **Modalidad:** ${g.modalidad || '100% Online / Semipresencial'}\n`;
  md += `- **Duración:** 4 años (8 semestres)\n`;
  if (g.perfil_egreso) md += `- **Perfil de Egreso:** ${g.perfil_egreso.trim()}\n`;
  if (g.campo_ocupacional) md += `- **Campo Ocupacional:** ${g.campo_ocupacional.trim()}\n`;
  if (g.requisitos_admision) md += `- **Requisitos de Admisión:** ${g.requisitos_admision.trim()}\n`;
  md += '\n';
});

md += '---\n\n';

// 3. PROGRAMAS ESPECIALES DE VALIDACIÓN
md += '## 3. Programas Especiales de Validación por Experiencia Laboral (Titulación Acelerada)\n\n';
md += '### 3.1 PE-12 Educación (Duración: 12 Meses | Arancel: $1.800 en 12 cuotas de $150)\n';
md += '- **Público Objetivo:** Docentes en ejercicio que ya cuentan con título previo de normalistas o bachilleres técnicos pedagógicos.\n';
md += '- **Requisitos:** Cédula, título previo registrado, certificado de experiencia laboral en instituciones educativas.\n\n';

md += '### 3.2 PE-15 Educación y Pedagogía (Duración: 15 Meses | Arancel: $2.250 en 15 cuotas de $150)\n';
md += '- **Programas Disponibles:** Licenciatura en Ciencias de la Educación, Licenciatura en Educación Inicial, Licenciatura en Pedagogía de Idiomas Nacionales y Extranjeros (Inglés).\n';
md += '- **Público Objetivo:** Bachilleres o tecnólogos con mínimo 4 años de experiencia laboral comprobable en docencia/instituciones educativas.\n';
md += '- **Marco Legal Documental Obligatorio:**\n';
md += '  1. **Certificado Laboral Institucional:** Con membrete oficial, cargo exacto de docente, desglose de funciones pedagógicas, fecha de inicio y fin.\n';
md += '  2. **Declaración Juramentada Notarizada:** Con idéntica información a la del certificado laboral.\n';
md += '  3. **Mecanizado del IESS:** Exclusivamente en Licenciatura en Ciencias de la Educación se acepta el historial mecanizado detallado del IESS como reemplazo de la declaración juramentada notariada.\n\n';

md += '### 3.3 Validación en Licenciatura en Seguridad y Salud Ocupacional\n';
md += '- **Público Objetivo:** Personas con mínimo 4 años de experiencia laboral en departamentos de seguridad y salud en el trabajo, prevención de riesgos laborales o comités paritarios (no aplica seguridad física ni vigilancia patrimonial).\n';
md += '- **Requisitos adicionales:** Edad mínima 22 años cumplidos, certificado firmado por el Director de Talento Humano o Gerencia General.\n\n---\n\n';

// 4. MAESTRÍAS ONLINE (49)
md += '## 4. Maestrías Oficiales Online (49 Programas SENESCYT - 12 Meses)\n\n';
md += '> **Requisito Legal Indispensable:** Contar con Título de Tercer Nivel (Licenciatura, Ingeniería o Tecnología Superior) registrado en el sistema SENESCYT.\n\n';

const maestrias = data.filter(d => d.titulo.toLowerCase().includes('maestría') || d.titulo.toLowerCase().includes('master'));
const groupedM = {};
maestrias.forEach(m => {
  const rawCat = m.categoria || m.area || 'Otras';
  const cat = rawCat.replace(/^\d+_/, '').replace(/_/g, ' ');
  if (!groupedM[cat]) groupedM[cat] = [];
  groupedM[cat].push(m);
});

for (const [cat, list] of Object.entries(groupedM)) {
  md += `### Área: ${cat} (${list.length} Programas)\n`;
  list.forEach(m => {
    md += `- **${m.titulo}**\n`;
    md += `  * Duración: 12 meses | Carga: 5 horas/semana | Modalidad: 100% Online.\n`;
    if (m.campo_ocupacional) md += `  * Enfoque: ${m.campo_ocupacional.substring(0, 150)}...\n`;
  });
  md += '\n';
}

const outPath = path.join(__dirname, '..', 'docs', 'catalogo_completo_carreras_ube.md');
fs.writeFileSync(outPath, md, 'utf-8');
console.log('Archivo generado:', outPath, 'Bytes:', md.length);
