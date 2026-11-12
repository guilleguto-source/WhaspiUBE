import json

with open('/home/guto/ube-bot/wa-bot/data/bateria_personajes_64.json', 'r', encoding='utf-8') as f:
    personajes_64 = json.load(f)

nuevos_8 = [
    {
        'id': 'P65',
        'nombre': 'Holger Cobeña',
        'ciudad': 'Puerto Ayora (Galápagos)',
        'phone': '593980004065',
        'arquetipo': 'Guía turístico en Galápagos con internet satelital intermitente buscando carrera asincrónica',
        'categoria': 'Casos Especiales y Regionales (Nuevos 8)',
        'tipo': 'grado_regular',
        'sigueGuion': True,
        'mensajes': [
            'Hola buenas tardes Diana... le escribo desde Santa Cruz Galápagos, me interesa Administración pero aquí el internet a veces se va por el clima satelital',
            'Holger Cobeña de Puerto Ayora... ¿las clases son 100% en vivo o puedo ver las grabaciones en la noche?',
            'Excelente, le paso mi cédula de Galápagos para el beneficio de matrícula: 2002345672',
            'Por favor ayúdeme reservando el cupo para este período'
        ],
        'aserciones': {
            'nombre': 'Holger Cobeña',
            'ruta': 'grado',
            'confirmado': True
        }
    },
    {
        'id': 'P66',
        'nombre': 'Jipson Andy',
        'ciudad': 'El Coca (Orellana)',
        'phone': '593980004066',
        'arquetipo': 'Operador petrolero amazónico con turnos 14/14 que necesita flexibilidad para exámenes',
        'categoria': 'Casos Especiales y Regionales (Nuevos 8)',
        'tipo': 'grado_regular',
        'sigueGuion': True,
        'mensajes': [
            'Buenas tardes licenciada, trabajo en campo petrolero en el Coca con turnos 14 días adentro y 14 libres. ¿Puedo estudiar Sistemas así?',
            'Mi nombre es Jipson Andy de acá de Orellana. Necesito saber si los exámenes son en fin de semana',
            'Le paso mi documento para que me revise los costos: 2202345670',
            'Listo confirmado mi cupo licenciada muchas gracias'
        ],
        'aserciones': {
            'nombre': 'Jipson Andy',
            'ruta': 'grado',
            'confirmado': True
        }
    },
    {
        'id': 'P67',
        'nombre': 'Cabo Segundo Luis Morales',
        'ciudad': 'Quito',
        'phone': '593980004067',
        'arquetipo': 'Policía Nacional en servicio activo con pases y traslados frecuentes buscando Licenciatura en Derecho',
        'categoria': 'Casos Especiales y Regionales (Nuevos 8)',
        'tipo': 'validacion_pe',
        'sigueGuion': True,
        'mensajes': [
            'Estimada Diana buenas noches, soy servidor policial técnico operativo, llevo 6 años en la institución y busco profesionalizarme en Derecho',
            'Soy Luis Morales de la ciudad de Quito. Por mi servicio me rotan de plaza cada cierto tiempo, por eso requiero validar experiencia y estudiar online',
            'Mi número de cédula para el análisis es 1702345677',
            'Por favor procedamos con la reserva y revisión de mi carpeta laboral'
        ],
        'aserciones': {
            'nombre': 'Luis Morales',
            'ruta': 'validacion',
            'confirmado': True
        }
    },
    {
        'id': 'P68',
        'nombre': 'Don Gonzalo Astudillo',
        'ciudad': 'Cuenca',
        'phone': '593980004068',
        'arquetipo': 'Aspirante jubilado de 63 años que desea cumplir su sueño de graduarse de Abogado pero teme a la tecnología',
        'categoria': 'Casos Especiales y Regionales (Nuevos 8)',
        'tipo': 'grado_regular',
        'sigueGuion': True,
        'mensajes': [
            'Buenas tardes señorita Diana. Tengo 63 años, soy jubilado en Cuenca y siempre quise ser Abogado, pero no domino mucho las computadoras. ¿Hay inducción?',
            'Gonzalo Astudillo a sus órdenes mi estimada. Si me tienen paciencia con la plataforma yo le dedico todo el día con gusto',
            'Con mucho gusto señorita, mi cédula es 0102345675 para registrarme',
            'Muchas gracias mi estimada Diana, por favor me aparta el cupito'
        ],
        'aserciones': {
            'nombre': 'Gonzalo Astudillo',
            'ruta': 'grado',
            'confirmado': True
        }
    },
    {
        'id': 'P69',
        'nombre': 'Yadira Quijije',
        'ciudad': 'Portoviejo / Queens (NY)',
        'phone': '593980004069',
        'arquetipo': 'Migrante manabita en Nueva York buscando estudiar Maestría en Educación con pagos internacionales',
        'categoria': 'Casos Especiales y Regionales (Nuevos 8)',
        'tipo': 'maestria_2pasos',
        'sigueGuion': True,
        'mensajes': [
            'Hola Dianita qué tal! Soy licenciada en ciencias de la educación graduada en Manabí pero radico en Queens NY. Quiero sacar mi maestría online avalada por Senescyt',
            'Yadira Quijije. ¿Puedo pagar las cuotas mensuales con tarjeta de crédito emitida acá en Estados Unidos?',
            'Mi cédula ecuatoriana es 1302345671',
            'Listo mi estimada, de una coordinemos la reserva de la maestría'
        ],
        'aserciones': {
            'nombre': 'Yadira Quijije',
            'ruta': 'maestria',
            'confirmado': True
        }
    },
    {
        'id': 'P70',
        'nombre': 'Dayana Estupiñán',
        'ciudad': 'Esmeraldas',
        'phone': '593980004070',
        'arquetipo': 'Madre soltera afroecuatoriana consultando por becas del 100%, bono del MIES y convenios sociales',
        'categoria': 'Casos Especiales y Regionales (Nuevos 8)',
        'tipo': 'disruptivo',
        'sigueGuion': False,
        'mensajes': [
            'Hola buenas... yo tengo carnet de discapacidad del 40% y cobro el bono de desarrollo humano. ¿Tienen beca del 100% o la carrera sale gratis?',
            'Dayana Estupiñán de acá de Esmeraldas... quiero saber la verdad si me van a cobrar mensualidades altas porque mi presupuesto es bien ajustado',
            'Si me aseguran una beca o descuento real les doy mi cédula: 0802345678',
            'Bueno me convenció señorita, agéndeme la información detallada'
        ],
        'aserciones': {
            'nombre': 'Dayana Estupiñán',
            'ruta': 'grado',
            'confirmado': True
        }
    },
    {
        'id': 'P71',
        'nombre': 'Ing. Carlos Julio Paladines',
        'ciudad': 'Machala',
        'phone': '593980004071',
        'arquetipo': 'Profesional con título de pregrado obtenido en Colombia/Perú consultando homologación previa en SENESCYT para maestría',
        'categoria': 'Casos Especiales y Regionales (Nuevos 8)',
        'tipo': 'maestria_2pasos',
        'sigueGuion': True,
        'mensajes': [
            'Buen día Diana. Soy Ingeniero Civil graduado en Colombia con título debidamente apostillado. ¿Puedo ingresar directamente a la Maestría en Gestión de Proyectos?',
            'Carlos Paladines desde Machala El Oro. Mi título ya está en trámite de registro en Senescyt',
            'Mi número de cédula de identidad ecuatoriana es 0702345679',
            'De acuerdo Diana, procedamos con la pre-inscripción y envío de la malla curricular'
        ],
        'aserciones': {
            'nombre': 'Carlos Paladines',
            'ruta': 'maestria',
            'confirmado': True
        }
    },
    {
        'id': 'P72',
        'nombre': 'Geovany Pata',
        'ciudad': 'Catamayo (Loja)',
        'phone': '593980004072',
        'arquetipo': 'Aspirante lojano ultra-coloquial con jerga popular andina/costeña testeando resistencia NLP',
        'categoria': 'Casos Especiales y Regionales (Nuevos 8)',
        'tipo': 'disruptivo',
        'sigueGuion': False,
        'mensajes': [
            'Habla mi llave buenas tardes... chuta ando buscando una carrera pero que no sea puro floro, algo de computación o redes bien bacán',
            'Geovany Pata de por acá de Catamayo Loja... dígame la firme cuánto hay que soltar de una para entrar',
            'Ya pues ñaña no sea malita mire mi cédula a ver si hay descuento: 1102345673',
            'Ya chévere de una guarde el cupo'
        ],
        'aserciones': {
            'nombre': 'Geovany Pata',
            'ruta': 'grado',
            'confirmado': True
        }
    }
]

todos = personajes_64 + nuevos_8

lines = []
lines.append('# Batería de Pruebas: 72 Personajes y Personalidades Ecuatorianas para WhaspiUBE (Diana)')
lines.append('')
lines.append('> **Manual Oficial de Casos de Prueba para el Embudo de Admisiones UBE**  ')
lines.append('> Diseñado para validar el pipeline conversacional en 4 turnos (T1: Filtro de ruta → T2: Identidad y perfil → T3: Cédula con beneficio → T4: Cierre/Ficha de admisión).')
lines.append('')
lines.append('---')
lines.append('')
lines.append('## 1. Métricas Generales de la Suite (72 Personajes)')
lines.append('')
lines.append('| Dimensión | Total Casos | Porcentaje | Propósito de Prueba |')
lines.append('| :--- | :---: | :---: | :--- |')
lines.append('| **Alineados al Embudo** | 36 | 50.0% | Flujo ideal en 4 turnos: grado regular, maestría 2 pasos, validación PE-15 y agendamiento de citas. |')
lines.append('| **Disruptivos y Casos Límite** | 36 | 50.0% | Objeciones de precio/cédula, saltos de tema, carreras inexistentes, monosílabos, etc. |')
lines.append('| **Total Personajes** | **72** | **100%** | **Cobertura integral nacional y estrés conversacional.** |')
lines.append('')
lines.append('### Distribución por Categorías:')
lines.append('')
cats = {}
for p in todos:
    c = p.get('categoria', 'Otros')
    cats[c] = cats.get(c, 0) + 1

for c, total in cats.items():
    lines.append(f'- **{c}**: {total} casos')

lines.append('')
lines.append('---')
lines.append('')
lines.append('## 2. Índice Resumen de los 72 Personajes')
lines.append('')
lines.append('| ID | Nombre | Ciudad / Provincia | Categoría | Tipo / Flujo | Teléfono Virtual |')
lines.append('| :---: | :--- | :--- | :--- | :--- | :--- |')
for p in todos:
    lines.append(f"| **{p['id']}** | {p['nombre']} | {p['ciudad']} | {p['categoria']} | `{p['tipo']}` | `{p['phone']}` |")

lines.append('')
lines.append('---')
lines.append('')
lines.append('## 3. Detalle Completo de Personajes y Guiones de Prueba')
lines.append('')

cat_actual = ''
for p in todos:
    if p['categoria'] != cat_actual:
        cat_actual = p['categoria']
        lines.append(f'### 📂 {cat_actual}')
        lines.append('')

    es_guion = 'Sí (Alineado)' if p.get('sigueGuion', False) else 'No (Disruptivo)'
    aserc = p.get('aserciones', {})
    ruta_esp = aserc.get('ruta', 'N/A')
    conf_esp = 'Sí' if aserc.get('confirmado', False) else 'No'

    lines.append(f"#### `{p['id']}` · {p['nombre']} — *{p['ciudad']}*")
    lines.append(f"- **Arquetipo:** {p['arquetipo']}")
    lines.append(f"- **Teléfono Virtual:** `{p['phone']}`")
    lines.append(f"- **Tipo de Flujo:** `{p['tipo']}` | **Sigue Guion:** `{es_guion}`")
    lines.append(f"- **Aserciones Esperadas:** Ruta: `{ruta_esp}` | Cierre Confirmado: `{conf_esp}`")
    lines.append('')
    lines.append('**Diálogo del Prospecto (WhatsApp):**')
    lines.append('```text')
    for idx, msg in enumerate(p.get('mensajes', []), start=1):
        lines.append(f'T{idx} > "{msg}"')
    lines.append('```')
    lines.append('')

lines.append('---')
lines.append('')
lines.append('## 4. Los 8 Nuevos Personajes Complementarios (P65 a P72)')
lines.append('')
lines.append('> [!NOTE]')
lines.append('> Estos 8 personajes complementan la suite original de 64 para cubrir nichos geográficos estratégicos (Galápagos, Amazonía Petrolera, Policía Nacional en servicio, Adultos Mayores jubilados, Ecuatorianos en el Exterior, Discapacidad/Bono social, Convalidación de Título Extranjero y Lenguaje Coloquial Extremo).')
lines.append('')
lines.append('| ID | Personaje | Región / Contexto | Caso Específico Evaluado |')
lines.append('| :---: | :--- | :--- | :--- |')
lines.append('| **P65** | Holger Cobeña | Puerto Ayora, Galápagos | Conectividad satelital y modalidad 100% asincrónica grabada. |')
lines.append('| **P66** | Jipson Andy | El Coca, Orellana | Turnos petroleros 14/14 y flexibilidad de fechas para evaluaciones. |')
lines.append('| **P67** | Luis Morales | Quito / Policía Nacional | Servidor policial con traslados continuos y validación de experiencia. |')
lines.append('| **P68** | Gonzalo Astudillo | Cuenca | Adulto mayor (63 años) jubilado con temor al uso de plataformas virtuales. |')
lines.append('| **P69** | Yadira Quijije | Queens, NY (Migrante) | Docente ecuatoriana en el exterior pagando con tarjeta internacional. |')
lines.append('| **P70** | Dayana Estupiñán | Esmeraldas | Solicitud de beca 100%, bono del MIES y presupuesto vulnerable. |')
lines.append('| **P71** | Carlos Paladines | Machala | Profesional con pregrado en el exterior (Colombia) en trámite de SENESCYT. |')
lines.append('| **P72** | Geovany Pata | Catamayo, Loja | Resistencia de procesamiento de lenguaje natural ante jerga callejera. |')
lines.append('')
lines.append('---')
lines.append('')
lines.append('## 5. Instrucciones de Ejecución')
lines.append('')
lines.append('### Opción 1: Ejecución Masiva por CLI')
lines.append('```bash')
lines.append('# Ejecutar los primeros 10 personajes')
lines.append('docker exec ube-wa-bot node test-bateria.js --limit=10')
lines.append('')
lines.append('# Ejecutar filtrando por categoría (ej. disruptivos)')
lines.append('docker exec ube-wa-bot node test-bateria.js --tipo=disruptivo')
lines.append('')
lines.append('# Ejecutar la suite completa de 72 casos')
lines.append('docker exec ube-wa-bot node test-bateria.js --limit=72')
lines.append('```')
lines.append('')
lines.append('### Opción 2: Prueba en el Simulador Web')
lines.append('1. Ingresa a **http://localhost:3000** en tu navegador.')
lines.append('2. En el panel de simulación, copia y pega los mensajes de cualquiera de los 72 personajes.')
lines.append('3. Verifica cómo Diana detecta automáticamente el nombre, la ciudad, clasifica la carrera y solicita la cédula vinculada a un beneficio.')

md_content = '\n'.join(lines)
with open('/home/guto/ube-bot/wa-bot/BATERIA_PERSONAJES_ECUATORIANOS.md', 'w', encoding='utf-8') as f:
    f.write(md_content)

with open('/home/guto/ube-bot/wa-bot/data/bateria_personajes_72.json', 'w', encoding='utf-8') as f:
    json.dump(todos, f, indent=2, ensure_ascii=False)

# Actualizar también bateria_personajes_64.json para que el runner test-bateria.js cargue los 72 sin modificar rutas
with open('/home/guto/ube-bot/wa-bot/data/bateria_personajes_64.json', 'w', encoding='utf-8') as f:
    json.dump(todos, f, indent=2, ensure_ascii=False)

print('Proceso completado exitosamente.')
