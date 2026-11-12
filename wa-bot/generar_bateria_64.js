const fs = require('fs');
const path = require('path');

// Generador de la Batería Oficial de 64 Personajes Ecuatorianos para WhaspiUBE (Diana)
// Distribución matemática exacta del gráfico oficial:
// 1. Alineados: Grado y Bachilleres (10)
// 2. Alineados: Validación PE (8)
// 3. Alineados: Maestrías 2 Pasos (10)
// 4. Alineados: Agendamiento Citas (4) - Días de la semana Lunes a Sábado
// 5. Disruptivos: Saltos de Tema y Desorden (8)
// 6. Disruptivos: Objeciones Duras y Desconfianza (6)
// 7. Disruptivos: Carreras Inexistentes (4)
// 8. Disruptivos: Cambio de Carrera en Vivo (4)
// 9. Disruptivos: Todo en 1 solo mensaje (4)
// 10. Disruptivos: Preguntas Académicas Frecuentes (4)
// 11. Disruptivos: Monosílabos y Casos Límite (2)
// Total = 32 Alineados (50%) + 32 Disruptivos (50%) = 64 Personajes

const personajes = [];
let contadorId = 1;

function agregarPersonaje({ nombre, ciudad, arquetipo, categoria, tipo, sigueGuion, mensajes, aserciones }) {
  const num = String(contadorId).padStart(2, '0');
  const id = `P${num}`;
  const phone = `5939800040${num}`;
  personajes.push({
    id,
    nombre,
    ciudad,
    phone,
    arquetipo,
    categoria,
    tipo,
    sigueGuion,
    mensajes,
    aserciones: {
      nombre,
      ...aserciones
    }
  });
  contadorId++;
}

// =========================================================================
// 1. ALINEADOS: GRADO Y BACHILLERES (10) · P01 - P10
// =========================================================================
agregarPersonaje({
  nombre: 'Brayan Holguín',
  ciudad: 'Guayaquil',
  arquetipo: 'Joven bachiller que trabaja en taller mecánico en el Guasmo',
  categoria: 'Alineados: Grado y Bachilleres',
  tipo: 'grado_regular',
  sigueGuion: true,
  mensajes: [
    'q tal ñaña buenas... toy interesado en ingenieria en sistemas pero ando en el camello',
    'Brayan Holguin de aca de Guayaquil... sali del colegio hace 2 anos y quiero superarme',
    'Mi cédula para el beneficio es 0902345677 de una ñaña',
    'De una separeme el cupo mi llave'
  ],
  aserciones: { ruta: 'grado', confirmado: true }
});

agregarPersonaje({
  nombre: 'Doménica Sarango',
  ciudad: 'Loja',
  arquetipo: 'Bachiller lojana con vocación para educación primaria',
  categoria: 'Alineados: Grado y Bachilleres',
  tipo: 'grado_regular',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes estimada señorita, deseo información de la licenciatura en educación básica',
    'Domenica Sarango desde Loja... acabo de graduarme del colegio de bachiller en ciencias',
    'Mi número de cédula para consultar el beneficio es 1102345673',
    'Sí por favor, sepáreme el cupo con el beneficio de pronto pago'
  ],
  aserciones: { ruta: 'grado', confirmado: true }
});

agregarPersonaje({
  nombre: 'Wellington Coello',
  ciudad: 'Babahoyo',
  arquetipo: 'Emprendedor de Los Ríos en el negocio de granos',
  categoria: 'Alineados: Grado y Bachilleres',
  tipo: 'grado_regular',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes licen quiero saber de administracion de empresas',
    'Wellington Coello de Babahoyo... tengo mi negocio propio y quiero el título universitario',
    'Le paso mi cedula para el sistema: 1202345672',
    'Claro que sí licen, apárteme el cupo'
  ],
  aserciones: { ruta: 'grado', confirmado: true }
});

agregarPersonaje({
  nombre: 'Shirley Tupiza',
  ciudad: 'Cayambe',
  arquetipo: 'Joven trabajadora de florícola interesada en finanzas',
  categoria: 'Alineados: Grado y Bachilleres',
  tipo: 'grado_regular',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes veci, cuánto cuesta la carrera de contabilidad y auditoría',
    'Shirley Tupiza desde Cayambe veci... trabajo en contabilidad básica en la plantación',
    'Mi número de cédula es 1702345677 para ver el descuento',
    'Por favor veci, ayúdeme apartando el cupo'
  ],
  aserciones: { ruta: 'grado', confirmado: true }
});

agregarPersonaje({
  nombre: 'Fabricio Mite',
  ciudad: 'Santa Elena',
  arquetipo: 'Bachiller peninsular del sector hotelero',
  categoria: 'Alineados: Grado y Bachilleres',
  tipo: 'grado_regular',
  sigueGuion: true,
  mensajes: [
    'Habla mi pana buenas, me interesa la carrera de turismo',
    'Fabricio Mite de aca de Santa Elena mi pana... bachiller técnico en hotelería',
    'Claro aquí le paso mi cedula pana: 0902345677',
    'De una mi pana, resérveme ese cupo'
  ],
  aserciones: { ruta: 'grado', confirmado: true }
});

agregarPersonaje({
  nombre: 'Gissella Cárdenas',
  ciudad: 'Cuenca',
  arquetipo: 'Creativa morlaca interesada en publicidad y medios digitales',
  categoria: 'Alineados: Grado y Bachilleres',
  tipo: 'grado_regular',
  sigueGuion: true,
  mensajes: [
    'Hola estimada qué tal, me interesa la carrera de diseño gráfico',
    'Gissella Cardenas desde Cuenca... me gusta la animación y la publicidad',
    'Le paso mi cédula: 0102345675 para que revise el pronto pago',
    'Sí estimada, proceda a apartarme el cupo'
  ],
  aserciones: { ruta: 'grado', confirmado: true }
});

agregarPersonaje({
  nombre: 'Kleber Zambrano',
  ciudad: 'El Carmen',
  arquetipo: 'Joven manabita enfocado en relaciones comunitarias',
  categoria: 'Alineados: Grado y Bachilleres',
  tipo: 'grado_regular',
  sigueGuion: true,
  mensajes: [
    'Que tal compa buenas tardes, información de psicología',
    'Kleber Zambrano de aca de El Carmen... soy bachiller recién egresado',
    'Mi cédula compa es 1302345671',
    'Sepáreme el cupo de una vez compa'
  ],
  aserciones: { ruta: 'grado', confirmado: true }
});

agregarPersonaje({
  nombre: 'Evelyn Guamangate',
  ciudad: 'Pelileo',
  arquetipo: 'Trabajadora de confección textil buscando tecnificación',
  categoria: 'Alineados: Grado y Bachilleres',
  tipo: 'grado_regular',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes disculpe, quiero averiguar sobre ingeniería industrial',
    'Evelyn Guamangate desde Pelileo... trabajo en control de calidad en confección de jeans',
    'Tome mi cédula señorita: 1802345676',
    'Sí me conviene la cuota pronto pago, resérveme el cupo'
  ],
  aserciones: { ruta: 'grado', confirmado: true }
});

agregarPersonaje({
  nombre: 'Kevin Piguave',
  ciudad: 'Durán',
  arquetipo: 'Técnico de cableado que busca profesionalizarse cerca de casa',
  categoria: 'Alineados: Grado y Bachilleres',
  tipo: 'grado_regular',
  sigueGuion: true,
  mensajes: [
    'wena ñaño kiero info d ingenieria electrica en la UBE',
    'Kevin Piguave d Duran... vivo cerquita del campus km 5 via Yaguachi',
    'Aki te paso la cedula: 0902345677',
    'Bacan ñaño separeme el cupo'
  ],
  aserciones: { ruta: 'grado', confirmado: true }
});

agregarPersonaje({
  nombre: 'Rosa Chimborazo',
  ciudad: 'Riobamba',
  arquetipo: 'Auxiliar de párvulos buscando título de tercer nivel',
  categoria: 'Alineados: Grado y Bachilleres',
  tipo: 'grado_regular',
  sigueGuion: true,
  mensajes: [
    'Hola buenas tardes quiero saber de la licenciatura en educacion inicial en linea',
    'Rosa Chimborazo de Riobamba... bachiller, trabajo como auxiliar de aula',
    'Le paso mi número de cédula: 0602345670',
    'Por favor sepáreme el cupo señorita'
  ],
  aserciones: { ruta: 'grado', confirmado: true }
});

// =========================================================================
// 2. ALINEADOS: VALIDACIÓN POR EXPERIENCIA LABORAL PE (8) · P11 - P18
// =========================================================================
agregarPersonaje({
  nombre: 'Gladys Guamán',
  ciudad: 'Riobamba',
  arquetipo: 'Profesora fiscal comunitaria con 8 años de trayectoria',
  categoria: 'Alineados: Validación PE',
  tipo: 'validacion_pe',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes licen, quiero validar mis 8 años de servicio en educación básica',
    'Gladys Guaman de Riobamba... tengo nombramiento provisional y necesito titularme rápido',
    'Mi número de cédula para la validación es 0602345670',
    'Sí licenciada, apárteme el cupo de PE-15'
  ],
  aserciones: { ruta: 'validacion', confirmado: true }
});

agregarPersonaje({
  nombre: 'Nixon Batallas',
  ciudad: 'Santo Domingo',
  arquetipo: 'Agente de la CTE tecnólogo en tránsito con 5 años de servicio',
  categoria: 'Alineados: Validación PE',
  tipo: 'validacion_pe',
  sigueGuion: true,
  mensajes: [
    'Saludos cordiales deseo información de validación en ingeniería en tránsito',
    'Nixon Batallas de Santo Domingo, soy tecnólogo en transporte con 5 años de servicio operativo',
    'Le facilito mi cédula: 1702345677',
    'Excelente, proceda a apartar mi cupo en validación'
  ],
  aserciones: { ruta: 'validacion', confirmado: true }
});

agregarPersonaje({
  nombre: 'Ángel Mero',
  ciudad: 'Manta',
  arquetipo: 'Docente de inglés en colegio de Manabí con 6 años de experiencia',
  categoria: 'Alineados: Validación PE',
  tipo: 'validacion_pe',
  sigueGuion: true,
  mensajes: [
    'Hello buenas tardes, deseo validar experiencia para Pedagogía de los Idiomas Nacionales y Extranjeros',
    'Angel Mero de aca de Manta... 6 años dando clases de inglés en colegio fiscal',
    'Mi cédula ecuatoriana es 1302345671',
    'Yes please, confirme mi cupo para el ciclo'
  ],
  aserciones: { ruta: 'validacion', confirmado: true }
});

agregarPersonaje({
  nombre: 'Carmen Yánez',
  ciudad: 'Ambato',
  arquetipo: 'Educadora de centro infantil con 7 años de servicio',
  categoria: 'Alineados: Validación PE',
  tipo: 'validacion_pe',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes estimada, quiero titularme por experiencia en Educación Inicial',
    'Carmen Yanez desde Ambato... 7 años trabajando en centros infantiles del MIES',
    'Le doy mi número de cédula: 1802345676',
    'Sí estimada, ayúdeme congelando el cupo'
  ],
  aserciones: { ruta: 'validacion', confirmado: true }
});

agregarPersonaje({
  nombre: 'Darwin Vera',
  ciudad: 'Milagro',
  arquetipo: 'Técnico de seguridad industrial en ingenio azucarero',
  categoria: 'Alineados: Validación PE',
  tipo: 'validacion_pe',
  sigueGuion: true,
  mensajes: [
    'Saludos cordiales, quiero validar para Seguridad y Salud Ocupacional (SSO)',
    'Darwin Vera de aca de Milagro... 4 años como técnico de prevención en planta azucarera',
    'Mi número de cédula es 0902345677',
    'Correcto, separe mi cupo por favor'
  ],
  aserciones: { ruta: 'validacion', confirmado: true }
});

agregarPersonaje({
  nombre: 'Marcelo Cuenca',
  ciudad: 'Loja',
  arquetipo: 'Profesor rural de frontera con 9 años de experiencia',
  categoria: 'Alineados: Validación PE',
  tipo: 'validacion_pe',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes licenciada, busco el programa PE-15 de Ciencias de la Educación',
    'Marcelo Cuenca desde Loja... docente comunitario en frontera sur por 9 años',
    'Cédula: 1102345673 para registrar el beneficio institucional',
    'Por favor separe mi cupo para iniciar clases'
  ],
  aserciones: { ruta: 'validacion', confirmado: true }
});

agregarPersonaje({
  nombre: 'Geovanny Cedeño',
  ciudad: 'Chone',
  arquetipo: 'Jefe de agencia en cooperativa de ahorro con 6 años laborales',
  categoria: 'Alineados: Validación PE',
  tipo: 'validacion_pe',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes amiga, quiero validar experiencia para Licenciatura en Administración',
    'Geovanny Cedeno de Chone... 6 años como jefe operativo en cooperativa',
    'Mi cédula es 1302345671',
    'Adelante amiga, resérveme el cupo'
  ],
  aserciones: { ruta: 'validacion', confirmado: true }
});

agregarPersonaje({
  nombre: 'Patricia Quishpe',
  ciudad: 'Ibarra',
  arquetipo: 'Secretaria de junta parroquial con 5 años de gestión pública',
  categoria: 'Alineados: Validación PE',
  tipo: 'validacion_pe',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes estimada, deseo validar experiencia laboral en Gestión Pública',
    'Patricia Quishpe desde Ibarra... 5 años como secretaria en junta parroquial',
    'Le brindo mi cédula: 1002345674',
    'Con mucho gusto estimada, resérveme el cupo'
  ],
  aserciones: { ruta: 'validacion', confirmado: true }
});

// =========================================================================
// 3. ALINEADOS: MAESTRÍAS EN 2 PASOS (10) · P19 - P28
// =========================================================================
agregarPersonaje({
  nombre: 'Maritza Galarza',
  ciudad: 'Guayaquil',
  arquetipo: 'Licenciada en educación buscando maestría afín',
  categoria: 'Alineados: Maestrías 2 Pasos',
  tipo: 'maestria_2pasos',
  sigueGuion: true,
  mensajes: [
    'Hola buenas tardes, quisiera ver el catálogo de maestrías que tienen',
    'Maritza Galarza de Guayaquil... ya soy licenciada, me interesa el área de Educación',
    'Me llama la atención la Maestría en Pedagogía, mi cédula es 0902345677',
    'Sí sepáreme el cupo de maestría'
  ],
  aserciones: { ruta: 'maestria', confirmado: true }
});

agregarPersonaje({
  nombre: 'Andrés Viteri',
  ciudad: 'Quito',
  arquetipo: 'Abogado en libre ejercicio consultando posgrado legal',
  categoria: 'Alineados: Maestrías 2 Pasos',
  tipo: 'maestria_2pasos',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes qué maestrías ofertan actualmente',
    'Andres Viteri desde Quito... soy abogado titulado, me interesa el área de Derecho',
    'La Maestría en Derecho Procesal Penal me conviene, mi cédula es 1702345677',
    'Separe mi cupo estimado'
  ],
  aserciones: { ruta: 'maestria', confirmado: true }
});

agregarPersonaje({
  nombre: 'Lorena Moreira',
  ciudad: 'Portoviejo',
  arquetipo: 'Licenciada en enfermería buscando posgrado en salud',
  categoria: 'Alineados: Maestrías 2 Pasos',
  tipo: 'maestria_2pasos',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes deseo conocer los programas de cuarto nivel',
    'Lorena Moreira de Portoviejo... tengo título de tercer nivel en el área de Salud',
    'Me interesa la Maestría en Gestión de Servicios de Salud, mi cédula es 1302345671',
    'Sí amiga, por favor resérveme el cupo'
  ],
  aserciones: { ruta: 'maestria', confirmado: true }
});

agregarPersonaje({
  nombre: 'Santiago Noboa',
  ciudad: 'Cuenca',
  arquetipo: 'Ingeniero comercial consultando MBA',
  categoria: 'Alineados: Maestrías 2 Pasos',
  tipo: 'maestria_2pasos',
  sigueGuion: true,
  mensajes: [
    'Hola estimada, qué posgrados tienen disponibles',
    'Santiago Noboa desde Cuenca... mi título es en Administración y Negocios',
    'El MBA mención Gestión de Proyectos, mi cédula es 0102345675',
    'Proceda a congelar mi cupo estimada'
  ],
  aserciones: { ruta: 'maestria', confirmado: true }
});

agregarPersonaje({
  nombre: 'Andrea Cevallos',
  ciudad: 'Machala',
  arquetipo: 'Ingeniera en sistemas buscando maestría tecnológica',
  categoria: 'Alineados: Maestrías 2 Pasos',
  tipo: 'maestria_2pasos',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes quisiera el catálogo de maestrías online',
    'Andrea Cevallos desde Machala... soy ingeniera, me interesa el área de Tecnologías e Ingenierías',
    'La Maestría en Ciberseguridad Aplicada, cédula 0702345679',
    'Sí señorita, sepáreme el cupo de maestría'
  ],
  aserciones: { ruta: 'maestria', confirmado: true }
});

agregarPersonaje({
  nombre: 'Edison Toala',
  ciudad: 'Daule',
  arquetipo: 'Docente de colegio buscando maestría en inclusión',
  categoria: 'Alineados: Maestrías 2 Pasos',
  tipo: 'maestria_2pasos',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes deseo información de programas de cuarto nivel',
    'Edison Toala de Daule... trabajo en magisterio, área de Educación',
    'La Maestría en Educación Inclusiva me interesa, cédula 0902345677',
    'Apárteme el cupo estimada'
  ],
  aserciones: { ruta: 'maestria', confirmado: true }
});

agregarPersonaje({
  nombre: 'Cristina Játiva',
  ciudad: 'Ibarra',
  arquetipo: 'Doctora en jurisprudencia consultando derecho constitucional',
  categoria: 'Alineados: Maestrías 2 Pasos',
  tipo: 'maestria_2pasos',
  sigueGuion: true,
  mensajes: [
    'Saludos qué maestrías jurídicas tienen disponibles',
    'Cristina Jativa desde Ibarra... abogada en libre ejercicio, área de Derecho',
    'Maestría en Derecho Constitucional, mi cédula es 1002345674',
    'Sí por favor, reserve mi cupo'
  ],
  aserciones: { ruta: 'maestria', confirmado: true }
});

agregarPersonaje({
  nombre: 'Fausto Moncayo',
  ciudad: 'Latacunga',
  arquetipo: 'Auditor contable buscando maestría tributaria',
  categoria: 'Alineados: Maestrías 2 Pasos',
  tipo: 'maestria_2pasos',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes qué opciones de cuarto nivel manejan',
    'Fausto Moncayo desde Latacunga... CPA registrado, área de Administración y Finanzas',
    'Maestría en Auditoría y Tributación, cédula 0502345671',
    'Sí proceda con el cupo'
  ],
  aserciones: { ruta: 'maestria', confirmado: true }
});

agregarPersonaje({
  nombre: 'Johanna Villacís',
  ciudad: 'Ambato',
  arquetipo: 'Psicóloga buscando posgrado clínico',
  categoria: 'Alineados: Maestrías 2 Pasos',
  tipo: 'maestria_2pasos',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes tienen catálogo de posgrados',
    'Johanna Villacis desde Ambato... psicóloga general, área de Salud',
    'Maestría en Psicoterapia y Salud Mental, cédula 1802345676',
    'Claro que sí, sepáreme el cupo'
  ],
  aserciones: { ruta: 'maestria', confirmado: true }
});

agregarPersonaje({
  nombre: 'Roberto Álava',
  ciudad: 'Babahoyo',
  arquetipo: 'Administrador agropecuario buscando maestría en agronegocios',
  categoria: 'Alineados: Maestrías 2 Pasos',
  tipo: 'maestria_2pasos',
  sigueGuion: true,
  mensajes: [
    'Qué tal amiga qué maestrías tienen para el sector productivo',
    'Roberto Alava de Babahoyo... título de tercer nivel en área de Administración',
    'Maestría en Gestión Agroempresarial, cédula 1202345672',
    'De una amiga, reserve el cupo'
  ],
  aserciones: { ruta: 'maestria', confirmado: true }
});

// =========================================================================
// 4. ALINEADOS: AGENDAMIENTO DE CITAS (4) · P29 - P32 (Con días de semana)
// =========================================================================
agregarPersonaje({
  nombre: 'Jackson Preciado',
  ciudad: 'Esmeraldas',
  arquetipo: 'Costeño esmeraldeño que solicita llamada el Lunes',
  categoria: 'Alineados: Agendamiento Citas',
  tipo: 'agendamiento_llamada',
  sigueGuion: true,
  mensajes: [
    'Que fue mi bro buenas, busco informacion de ingenieria en sistemas',
    'Jackson Preciado de aca de Esmeraldas mi llave... ando ocupado en el taller, cuadremos una llamada',
    'El Lunes a las 10:30 am me timbran de una'
  ],
  aserciones: { llamada_estado: 'pendiente', llamada_agendada_horario: 'Lunes 10:30 Am' }
});

agregarPersonaje({
  nombre: 'Segundo Caiza',
  ciudad: 'Quito',
  arquetipo: 'Serrano comerciante que agenda llamada para el Martes',
  categoria: 'Alineados: Agendamiento Citas',
  tipo: 'agendamiento_llamada',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes veci... ayúdeme por favor con información de la carrera de derecho',
    'Segundo Caiza desde Quito... veci preferiría que me llamen por teléfono para coordinar bien',
    'Para el Martes a las 4:30 pm estaría perfecto veci'
  ],
  aserciones: { llamada_estado: 'pendiente', llamada_agendada_horario: 'Martes 04:30 Pm' }
});

agregarPersonaje({
  nombre: 'Jefferson Intriago',
  ciudad: 'Chone',
  arquetipo: 'Manaba ganadero que pacta llamada para el Miércoles',
  categoria: 'Alineados: Agendamiento Citas',
  tipo: 'agendamiento_llamada',
  sigueGuion: true,
  mensajes: [
    'Habla compa buenas tardes, quiero saber de administracion de empresas',
    'Jefferson Intriago de Chone manaba de cepa... ando en la vía, mejor agendemos llamada telefónica',
    'El Miércoles a las 11:15 am me queda preciso compa'
  ],
  aserciones: { llamada_estado: 'pendiente', llamada_agendada_horario: 'Miercoles 11:15 Am' }
});

agregarPersonaje({
  nombre: 'Lourdes Cando',
  ciudad: 'Cuenca',
  arquetipo: 'Madre de familia que agenda llamada para el Jueves',
  categoria: 'Alineados: Agendamiento Citas',
  tipo: 'agendamiento_llamada',
  sigueGuion: true,
  mensajes: [
    'Buenas tardes estimada, una consulta sobre enfermería semipresencial',
    'Lourdes Cando desde Cuenca... oiga señorita tengo varias dudas, pueden llamarme por teléfono?',
    'El Jueves a las 2:15 pm por favor'
  ],
  aserciones: { llamada_estado: 'pendiente', llamada_agendada_horario: 'Jueves 02:15 Pm' }
});

// =========================================================================
// 5. DISRUPTIVOS: SALTOS DE TEMA Y DESORDEN (8) · P33 - P40
// =========================================================================
agregarPersonaje({
  nombre: 'Byron Pincay',
  ciudad: 'Guayaquil',
  arquetipo: 'Aspirante guayaco disperso que mezcla preguntas de campus y deportes',
  categoria: 'Disruptivos: Saltos de Tema y Desorden',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'hola oye cuanto vale la carrera de sistemas y si hay piscina en el campus duran?',
    'Byron Pincay de Guayaquil... mi prima estudia odontologia alla en duran y dice que es bacan, yo quiero sistemas pero online',
    'oye y si no doy la cedula que pasa? bueno toma: 0902345677'
  ],
  aserciones: { ruta: 'grado' }
});

agregarPersonaje({
  nombre: 'Yolanda Guamán',
  ciudad: 'Riobamba',
  arquetipo: 'Aspirante serrana que salta entre horarios y vida familiar',
  categoria: 'Disruptivos: Saltos de Tema y Desorden',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Buenas tardes las clases de educación básica son en la noche? es que tengo dos guaguas pequeños',
    'Yolanda Guaman desde Riobamba... y los exámenes son en línea o toca viajar a Durán? porque el pasaje está caro',
    'Bueno mi cédula es 0602345670 daráme viendo si hay beca'
  ],
  aserciones: { ruta: 'grado' }
});

agregarPersonaje({
  nombre: 'Cristian Loor',
  ciudad: 'Manta',
  arquetipo: 'Futbolista barrial que pregunta por beca y tarjetas',
  categoria: 'Disruptivos: Saltos de Tema y Desorden',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'que mas tienen beca deportiva para futbolistas? quiero estudiar derecho',
    'Cristian Loor de Manta... oiga y se puede pagar con la tarjeta de mi tío en diferido?',
    'toma mi cedula man: 1302345671'
  ],
  aserciones: { ruta: 'grado' }
});

agregarPersonaje({
  nombre: 'Tatiana Mora',
  ciudad: 'Quito',
  arquetipo: 'Confundida entre estudiar maestría o segunda carrera',
  categoria: 'Disruptivos: Saltos de Tema y Desorden',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Hola quiero saber si me conviene estudiar otra carrera o mejor una maestría en talento humano',
    'Tatiana Mora de Quito... ya tengo un título en turismo pero no hay trabajo, qué me recomienda?',
    'Cédula 1702345677 para ver qué beneficio tengo'
  ],
  aserciones: {}
});

agregarPersonaje({
  nombre: 'Jonathan Vaca',
  ciudad: 'Quevedo',
  arquetipo: 'Duda entre validar experiencia o empezar desde primer semestre',
  categoria: 'Disruptivos: Saltos de Tema y Desorden',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Buenas tardes trabajo en una bananera 3 años, puedo validar en administración o empiezo de cero?',
    'Jonathan Vaca de Quevedo... la verdad no tengo certificados del iess completos, solo cartas patronales',
    'Mi cédula es 1202345672 para que me revise'
  ],
  aserciones: {}
});

agregarPersonaje({
  nombre: 'Belén Alarcón',
  ciudad: 'Loja',
  arquetipo: 'Pregunta carnet estudiantil, convenios y cuotas',
  categoria: 'Disruptivos: Saltos de Tema y Desorden',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Hola el carnet de la UBE sirve para descuento de pasajes interprovinciales?',
    'Belen Alarcon desde Loja... quiero estudiar psicología pero también saber si tienen convenio con clínicas en Loja',
    'Cédula 1102345673'
  ],
  aserciones: { ruta: 'grado' }
});

agregarPersonaje({
  nombre: 'Washington Solís',
  ciudad: 'Daule',
  arquetipo: 'Quiere homologar materias de universidad pública',
  categoria: 'Disruptivos: Saltos de Tema y Desorden',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Buenas tardes dejé botada la carrera de derecho en la estatal en 4to semestre, me convalidan?',
    'Washington Solis de aca de Daule... tengo los syllabus firmados',
    'Revíseme con mi cédula 0902345677'
  ],
  aserciones: { ruta: 'grado' }
});

agregarPersonaje({
  nombre: 'Nicole Peñafiel',
  ciudad: 'Milagro',
  arquetipo: 'Consulta para ella y su esposo en el mismo mensaje',
  categoria: 'Disruptivos: Saltos de Tema y Desorden',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Hola quiero información de enfermería para mí y de sistemas para mi esposo, hay descuento en pareja?',
    'Nicole Penafiel de Milagro... los dos queremos estudiar online en las noches',
    'Mi cédula es 0902345677 y la de él termina en 88'
  ],
  aserciones: {}
});

// =========================================================================
// 6. DISRUPTIVOS: OBJECIONES DURAS Y DESCONFIANZA (6) · P41 - P46
// =========================================================================
agregarPersonaje({
  nombre: 'Carlos Intriago',
  ciudad: 'Chone',
  arquetipo: 'Manaba receloso que no quiere dar la cédula',
  categoria: 'Disruptivos: Objeciones Duras y Desconfianza',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Quiero saber cuánto cuesta la carrera de derecho',
    'Carlos Intriago de Chone... pero por qué me pides la cédula si ni te conozco? esto parece estafa',
    'Bueno si es para beneficio institucional tome: 1302345671 pero no me vayan a endeudar'
  ],
  aserciones: { ruta: 'grado' }
});

agregarPersonaje({
  nombre: 'Mercedes Tenelema',
  ciudad: 'Guaranda',
  arquetipo: 'Objeción fuerte por precio comparado con universidad pública',
  categoria: 'Disruptivos: Objeciones Duras y Desconfianza',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Cuánto cobran por la licenciatura en educación?',
    'Mercedes Tenelema desde Guaranda... uy señorita $180 al mes es carísimo, en la pública es gratis',
    'Explíqueme bien lo del pronto pago a ver si me alcanza, cédula 0202345674'
  ],
  aserciones: { ruta: 'grado' }
});

agregarPersonaje({
  nombre: 'Franklin Coello',
  ciudad: 'Babahoyo',
  arquetipo: 'Desconfianza en dar datos por WhatsApp',
  categoria: 'Disruptivos: Objeciones Duras y Desconfianza',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Deseo saber sobre administración de empresas',
    'Franklin Coello de Babahoyo... no me da confianza poner datos privados por chat de whatsapp',
    'Si me garantiza que es seguro le paso la cédula: 1202345672'
  ],
  aserciones: { ruta: 'grado' }
});

agregarPersonaje({
  nombre: 'Glenda Pilataxi',
  ciudad: 'Latacunga',
  arquetipo: 'Rumores de falta de sede física',
  categoria: 'Disruptivos: Objeciones Duras y Desconfianza',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Me interesa psicología pero me dijeron que la UBE no tiene campus propio',
    'Glenda Pilataxi desde Latacunga... cómo sé que es una universidad de verdad y no de papel?',
    'Verifíqueme el beneficio con mi cédula 0502345671'
  ],
  aserciones: { ruta: 'grado' }
});

agregarPersonaje({
  nombre: 'Javier Macías',
  ciudad: 'Portoviejo',
  arquetipo: 'Miedo a penalidades o expulsión por retraso en pagos',
  categoria: 'Disruptivos: Objeciones Duras y Desconfianza',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Información de ingeniería en sistemas por favor',
    'Javier Macias de Portoviejo... si un mes me atraso en pagar la cuota me cobran intereses o me botan del ciclo?',
    'Mi cédula es 1302345671 para revisar los aranceles'
  ],
  aserciones: { ruta: 'grado' }
});

agregarPersonaje({
  nombre: 'Mónica Reascos',
  ciudad: 'Tulcán',
  arquetipo: 'Temor a clonación de identidad y delitos informáticos',
  categoria: 'Disruptivos: Objeciones Duras y Desconfianza',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Buenas tardes qué requisitos piden para enfermería?',
    'Monica Reascos desde Tulcan... cómo sé que ustedes no usan mi cédula para sacar créditos?',
    'Está bien le creo, mi cédula es 0402345672'
  ],
  aserciones: { ruta: 'grado' }
});

// =========================================================================
// 7. DISRUPTIVOS: CARRERAS INEXISTENTES (4) · P47 - P50
// =========================================================================
agregarPersonaje({
  nombre: 'Jorge Bazurto',
  ciudad: 'Guayaquil',
  arquetipo: 'Pide Medicina Humana para ser cirujano (No ofertada)',
  categoria: 'Disruptivos: Carreras Inexistentes',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Hola buenas quiero estudiar Medicina Humana para graduarme de médico cirujano',
    'Jorge Bazurto de Guayaquil... no tienen medicina? qué otra carrera del área de salud me ofrecen?',
    'Enfermería me parece bien, mi cédula es 0902345677'
  ],
  aserciones: { ciudad: 'Guayaquil' }
});

agregarPersonaje({
  nombre: 'Stefany Paucar',
  ciudad: 'Quito',
  arquetipo: 'Pide Medicina Veterinaria y Zootecnia (No ofertada)',
  categoria: 'Disruptivos: Carreras Inexistentes',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Buenas tardes tienen la carrera de Veterinaria y zootecnia?',
    'Stefany Paucar desde Quito... lástima que no tengan animales, qué carreras de ingeniería tienen?',
    'Sistemas Inteligentes me agrada, mi cédula es 1702345677'
  ],
  aserciones: { ciudad: 'Quito' }
});

agregarPersonaje({
  nombre: 'Ricardo Holguín',
  ciudad: 'Manta',
  arquetipo: 'Pide Gastronomía y Artes Culinarias (No ofertada)',
  categoria: 'Disruptivos: Carreras Inexistentes',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Q tal amiga kiero estudiar gastronomia y chef internacional',
    'Ricardo Holguin de Manta... no tienen cocina? y turismo tienen disponible?',
    'Turismo me sirve bastante aca en la playa, cédula 1302345671'
  ],
  aserciones: { ciudad: 'Manta' }
});

agregarPersonaje({
  nombre: 'Estela Quinde',
  ciudad: 'Cuenca',
  arquetipo: 'Pide Arquitectura Naval e Ingeniería de Minas (No ofertada)',
  categoria: 'Disruptivos: Carreras Inexistentes',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Buenas tardes tienen Arquitectura Naval o Ingeniería de Minas?',
    'Estela Quinde desde Cuenca... de las que tienen cuál es la más cercana a tecnología?',
    'Ingeniería Industrial me convence, cédula 0102345675'
  ],
  aserciones: { ciudad: 'Cuenca' }
});

// =========================================================================
// 8. DISRUPTIVOS: CAMBIO DE CARRERA EN VIVO (4) · P51 - P54
// =========================================================================
agregarPersonaje({
  nombre: 'Danny Quimi',
  ciudad: 'Santa Elena',
  arquetipo: 'Inicia consultando Derecho y cambia a Sistemas Inteligentes',
  categoria: 'Disruptivos: Cambio de Carrera en Vivo',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Buenas tardes me interesa estudiar Derecho presencial',
    'Danny Quimi de Santa Elena... oiga pensándolo bien prefiero Sistemas Inteligentes online porque viajo mucho',
    'Mi cédula es 0902345677 para apartar Sistemas'
  ],
  aserciones: { ciudad: 'Santa Elena' }
});

agregarPersonaje({
  nombre: 'Jessica Zambrano',
  ciudad: 'Santo Domingo',
  arquetipo: 'Inicia en Educación Básica y cambia a Psicología',
  categoria: 'Disruptivos: Cambio de Carrera en Vivo',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Hola quiero información de educación básica',
    'Jessica Zambrano desde Santo Domingo... sabe qué mejor ayúdeme con Psicología que me apasiona más',
    'Cédula 1702345677'
  ],
  aserciones: { ciudad: 'Santo Domingo' }
});

agregarPersonaje({
  nombre: 'Pablo Chiluisa',
  ciudad: 'Ambato',
  arquetipo: 'Inicia en Enfermería y cambia a Administración de Empresas',
  categoria: 'Disruptivos: Cambio de Carrera en Vivo',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Buenas tardes información de enfermería',
    'Pablo Chiluisa de Ambato... le tengo fobia a la sangre mejor cámbieme a Administración de Empresas',
    'Mi cédula es 1802345676'
  ],
  aserciones: { ciudad: 'Ambato' }
});

agregarPersonaje({
  nombre: 'Roxana Cañizares',
  ciudad: 'Daule',
  arquetipo: 'Inicia en Biomedicina y cambia a IA y Ciberseguridad',
  categoria: 'Disruptivos: Cambio de Carrera en Vivo',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Hola me interesa ingeniería en biomedicina en campus duran',
    'Roxana Canizares de aca de Daule... vi que tienen IA y Ciberseguridad 100% online, mejor esa',
    'Cédula 0902345677'
  ],
  aserciones: { ciudad: 'Daule' }
});

// =========================================================================
// 9. DISRUPTIVOS: TODO EN 1 SOLO MENSAJE (4) · P55 - P58
// =========================================================================
agregarPersonaje({
  nombre: 'Manuel Barrezueta',
  ciudad: 'Machala',
  arquetipo: 'Envía todos los datos juntos en su primer mensaje',
  categoria: 'Disruptivos: Todo en 1 solo mensaje',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Hola soy Manuel Barrezueta de Machala, cédula 0702345679, quiero estudiar Derecho a distancia, dígame costo y sepáreme el cupo'
  ],
  aserciones: { ciudad: 'Machala' }
});

agregarPersonaje({
  nombre: 'Diana Villacreses',
  ciudad: 'Quito',
  arquetipo: 'Profesional apurada que envía datos completos de maestría en un bloque',
  categoria: 'Disruptivos: Todo en 1 solo mensaje',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Buenas tardes mi nombre es Diana Villacreses de Quito cédula 1702345677 soy licenciada en educación y deseo matricularme en la maestría en pedagogía online'
  ],
  aserciones: { ciudad: 'Quito' }
});

agregarPersonaje({
  nombre: 'Pedro Tomalá',
  ciudad: 'Salinas',
  arquetipo: 'Trabajador que pide validación PE con todos sus datos',
  categoria: 'Disruptivos: Todo en 1 solo mensaje',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Que tal soy Pedro Tomala de Salinas cedula 0902345677 tengo 5 anos de experiencia en administracion quiero validar mi titulo rapido'
  ],
  aserciones: { ciudad: 'Salinas' }
});

agregarPersonaje({
  nombre: 'Lucía Carrión',
  ciudad: 'Loja',
  arquetipo: 'Aspirante lojana que manda nombre, ciudad, cédula y carrera de una',
  categoria: 'Disruptivos: Todo en 1 solo mensaje',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Saludos cordiales soy Lucia Carrion de Loja cédula 1102345673 bachiller me interesa enfermería semipresencial'
  ],
  aserciones: { ciudad: 'Loja' }
});

// =========================================================================
// 10. DISRUPTIVOS: PREGUNTAS ACADÉMICAS FRECUENTES (4) · P59 - P62
// =========================================================================
agregarPersonaje({
  nombre: 'Fabricio Palacios',
  ciudad: 'Guayaquil',
  arquetipo: 'Verifica estatus legal y registro en SENESCYT',
  categoria: 'Disruptivos: Preguntas Académicas Frecuentes',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Buenas tardes el título que emite la UBE está debidamente registrado y avalado por la SENESCYT?',
    'Fabricio Palacios de Guayaquil... es que necesito el título para concurso de méritos en el sector público',
    'Mi cédula es 0902345677 para verificar Sistemas'
  ],
  aserciones: { ciudad: 'Guayaquil' }
});

agregarPersonaje({
  nombre: 'Martha Córdova',
  ciudad: 'Quito',
  arquetipo: 'Pregunta si las clases son sincrónicas obligatorias o grabadas',
  categoria: 'Disruptivos: Preguntas Académicas Frecuentes',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Hola buenas tardes las clases en línea son con asistencia obligatoria a una hora fija?',
    'Martha Cordova de Quito... por mis turnos no siempre puedo conectarme en vivo, quedan grabadas?',
    'Cédula 1702345677'
  ],
  aserciones: { ciudad: 'Quito' }
});

agregarPersonaje({
  nombre: 'Gonzalo Tenorio',
  ciudad: 'Esmeraldas',
  arquetipo: 'Pregunta sobre campus físico y laboratorios en Durán',
  categoria: 'Disruptivos: Preguntas Académicas Frecuentes',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Qué tal tienen campus propio con laboratorios y clínicas para enfermería?',
    'Gonzalo Tenorio de Esmeraldas... me dijeron que queda en Durán en el km 5.5 vía Yaguachi verdad?',
    'Mi cédula es 0802345678'
  ],
  aserciones: { ciudad: 'Esmeraldas' }
});

agregarPersonaje({
  nombre: 'Karina Baldeón',
  ciudad: 'Riobamba',
  arquetipo: 'Pregunta facilidades de pago directo sin entidades bancarias',
  categoria: 'Disruptivos: Preguntas Académicas Frecuentes',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'Buenas tardes el pago de las cuotas es directo con la universidad o exigen crédito bancario?',
    'Karina Baldeon desde Riobamba... no tengo tarjeta de crédito, puedo pagar por transferencia o ventanilla?',
    'Cédula 0602345670'
  ],
  aserciones: { ciudad: 'Riobamba' }
});

// =========================================================================
// 11. DISRUPTIVOS: MONOSÍLABOS Y CASOS LÍMITE (2) · P63 - P64
// =========================================================================
agregarPersonaje({
  nombre: 'Luis Poma',
  ciudad: 'Cuenca',
  arquetipo: 'Usuario minimalista que responde solo con monosílabos',
  categoria: 'Disruptivos: Monosílabos y Casos Límite',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    'hola',
    'derecho',
    'si',
    '0102345675',
    'ok'
  ],
  aserciones: {}
});

agregarPersonaje({
  nombre: 'Bryan Soria',
  ciudad: 'Ambato',
  arquetipo: 'Usuario que inicia con emojis y textos ultra-cortos',
  categoria: 'Disruptivos: Monosílabos y Casos Límite',
  tipo: 'disruptivo',
  sigueGuion: false,
  mensajes: [
    '👋',
    'sistemas',
    'cuanto cuesta',
    '1802345676'
  ],
  aserciones: {}
});

// Guardar archivo JSON consolidado
const RUTA_SALIDA = path.join(__dirname, 'data', 'bateria_personajes_64.json');
fs.writeFileSync(RUTA_SALIDA, JSON.stringify(personajes, null, 2), 'utf-8');

console.log(`✅ Archivo generado con éxito: ${RUTA_SALIDA}`);
console.log(`Total de personajes generados: ${personajes.length}`);

// Resumen por categorías del gráfico oficial
const categoriasCount = {};
personajes.forEach(p => {
  categoriasCount[p.categoria] = (categoriasCount[p.categoria] || 0) + 1;
});
console.log('\n📊 DISTRIBUCIÓN MATEMÁTICA EXACTA:');
console.table(categoriasCount);
