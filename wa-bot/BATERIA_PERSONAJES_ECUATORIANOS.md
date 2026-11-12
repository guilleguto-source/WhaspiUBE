# Batería de Pruebas: 72 Personajes y Personalidades Ecuatorianas para WhaspiUBE (Diana)

> **Manual Oficial de Casos de Prueba para el Embudo de Admisiones UBE**  
> Diseñado para validar el pipeline conversacional en 4 turnos (T1: Filtro de ruta → T2: Identidad y perfil → T3: Cédula con beneficio → T4: Cierre/Ficha de admisión).

---

## 1. Métricas Generales de la Suite (72 Personajes)

| Dimensión | Total Casos | Porcentaje | Propósito de Prueba |
| :--- | :---: | :---: | :--- |
| **Alineados al Embudo** | 36 | 50.0% | Flujo ideal en 4 turnos: grado regular, maestría 2 pasos, validación PE-15 y agendamiento de citas. |
| **Disruptivos y Casos Límite** | 36 | 50.0% | Objeciones de precio/cédula, saltos de tema, carreras inexistentes, monosílabos, etc. |
| **Total Personajes** | **72** | **100%** | **Cobertura integral nacional y estrés conversacional.** |

### Distribución por Categorías:

- **Alineados: Grado y Bachilleres**: 10 casos
- **Alineados: Validación PE**: 8 casos
- **Alineados: Maestrías 2 Pasos**: 10 casos
- **Alineados: Agendamiento Citas**: 4 casos
- **Disruptivos: Saltos de Tema y Desorden**: 8 casos
- **Disruptivos: Objeciones Duras y Desconfianza**: 6 casos
- **Disruptivos: Carreras Inexistentes**: 4 casos
- **Disruptivos: Cambio de Carrera en Vivo**: 4 casos
- **Disruptivos: Todo en 1 solo mensaje**: 4 casos
- **Disruptivos: Preguntas Académicas Frecuentes**: 4 casos
- **Disruptivos: Monosílabos y Casos Límite**: 2 casos
- **Casos Especiales y Regionales (Nuevos 8)**: 8 casos

---

## 2. Índice Resumen de los 72 Personajes

| ID | Nombre | Ciudad / Provincia | Categoría | Tipo / Flujo | Teléfono Virtual |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **P01** | Brayan Holguín | Guayaquil | Alineados: Grado y Bachilleres | `grado_regular` | `593980004001` |
| **P02** | Doménica Sarango | Loja | Alineados: Grado y Bachilleres | `grado_regular` | `593980004002` |
| **P03** | Wellington Coello | Babahoyo | Alineados: Grado y Bachilleres | `grado_regular` | `593980004003` |
| **P04** | Shirley Tupiza | Cayambe | Alineados: Grado y Bachilleres | `grado_regular` | `593980004004` |
| **P05** | Fabricio Mite | Santa Elena | Alineados: Grado y Bachilleres | `grado_regular` | `593980004005` |
| **P06** | Gissella Cárdenas | Cuenca | Alineados: Grado y Bachilleres | `grado_regular` | `593980004006` |
| **P07** | Kleber Zambrano | El Carmen | Alineados: Grado y Bachilleres | `grado_regular` | `593980004007` |
| **P08** | Evelyn Guamangate | Pelileo | Alineados: Grado y Bachilleres | `grado_regular` | `593980004008` |
| **P09** | Kevin Piguave | Durán | Alineados: Grado y Bachilleres | `grado_regular` | `593980004009` |
| **P10** | Rosa Chimborazo | Riobamba | Alineados: Grado y Bachilleres | `grado_regular` | `593980004010` |
| **P11** | Gladys Guamán | Riobamba | Alineados: Validación PE | `validacion_pe` | `593980004011` |
| **P12** | Nixon Batallas | Santo Domingo | Alineados: Validación PE | `validacion_pe` | `593980004012` |
| **P13** | Ángel Mero | Manta | Alineados: Validación PE | `validacion_pe` | `593980004013` |
| **P14** | Carmen Yánez | Ambato | Alineados: Validación PE | `validacion_pe` | `593980004014` |
| **P15** | Darwin Vera | Milagro | Alineados: Validación PE | `validacion_pe` | `593980004015` |
| **P16** | Marcelo Cuenca | Loja | Alineados: Validación PE | `validacion_pe` | `593980004016` |
| **P17** | Geovanny Cedeño | Chone | Alineados: Validación PE | `validacion_pe` | `593980004017` |
| **P18** | Patricia Quishpe | Ibarra | Alineados: Validación PE | `validacion_pe` | `593980004018` |
| **P19** | Maritza Galarza | Guayaquil | Alineados: Maestrías 2 Pasos | `maestria_2pasos` | `593980004019` |
| **P20** | Andrés Viteri | Quito | Alineados: Maestrías 2 Pasos | `maestria_2pasos` | `593980004020` |
| **P21** | Lorena Moreira | Portoviejo | Alineados: Maestrías 2 Pasos | `maestria_2pasos` | `593980004021` |
| **P22** | Santiago Noboa | Cuenca | Alineados: Maestrías 2 Pasos | `maestria_2pasos` | `593980004022` |
| **P23** | Andrea Cevallos | Machala | Alineados: Maestrías 2 Pasos | `maestria_2pasos` | `593980004023` |
| **P24** | Edison Toala | Daule | Alineados: Maestrías 2 Pasos | `maestria_2pasos` | `593980004024` |
| **P25** | Cristina Játiva | Ibarra | Alineados: Maestrías 2 Pasos | `maestria_2pasos` | `593980004025` |
| **P26** | Fausto Moncayo | Latacunga | Alineados: Maestrías 2 Pasos | `maestria_2pasos` | `593980004026` |
| **P27** | Johanna Villacís | Ambato | Alineados: Maestrías 2 Pasos | `maestria_2pasos` | `593980004027` |
| **P28** | Roberto Álava | Babahoyo | Alineados: Maestrías 2 Pasos | `maestria_2pasos` | `593980004028` |
| **P29** | Jackson Preciado | Esmeraldas | Alineados: Agendamiento Citas | `agendamiento_llamada` | `593980004029` |
| **P30** | Segundo Caiza | Quito | Alineados: Agendamiento Citas | `agendamiento_llamada` | `593980004030` |
| **P31** | Jefferson Intriago | Chone | Alineados: Agendamiento Citas | `agendamiento_llamada` | `593980004031` |
| **P32** | Lourdes Cando | Cuenca | Alineados: Agendamiento Citas | `agendamiento_llamada` | `593980004032` |
| **P33** | Byron Pincay | Guayaquil | Disruptivos: Saltos de Tema y Desorden | `disruptivo` | `593980004033` |
| **P34** | Yolanda Guamán | Riobamba | Disruptivos: Saltos de Tema y Desorden | `disruptivo` | `593980004034` |
| **P35** | Cristian Loor | Manta | Disruptivos: Saltos de Tema y Desorden | `disruptivo` | `593980004035` |
| **P36** | Tatiana Mora | Quito | Disruptivos: Saltos de Tema y Desorden | `disruptivo` | `593980004036` |
| **P37** | Jonathan Vaca | Quevedo | Disruptivos: Saltos de Tema y Desorden | `disruptivo` | `593980004037` |
| **P38** | Belén Alarcón | Loja | Disruptivos: Saltos de Tema y Desorden | `disruptivo` | `593980004038` |
| **P39** | Washington Solís | Daule | Disruptivos: Saltos de Tema y Desorden | `disruptivo` | `593980004039` |
| **P40** | Nicole Peñafiel | Milagro | Disruptivos: Saltos de Tema y Desorden | `disruptivo` | `593980004040` |
| **P41** | Carlos Intriago | Chone | Disruptivos: Objeciones Duras y Desconfianza | `disruptivo` | `593980004041` |
| **P42** | Mercedes Tenelema | Guaranda | Disruptivos: Objeciones Duras y Desconfianza | `disruptivo` | `593980004042` |
| **P43** | Franklin Coello | Babahoyo | Disruptivos: Objeciones Duras y Desconfianza | `disruptivo` | `593980004043` |
| **P44** | Glenda Pilataxi | Latacunga | Disruptivos: Objeciones Duras y Desconfianza | `disruptivo` | `593980004044` |
| **P45** | Javier Macías | Portoviejo | Disruptivos: Objeciones Duras y Desconfianza | `disruptivo` | `593980004045` |
| **P46** | Mónica Reascos | Tulcán | Disruptivos: Objeciones Duras y Desconfianza | `disruptivo` | `593980004046` |
| **P47** | Jorge Bazurto | Guayaquil | Disruptivos: Carreras Inexistentes | `disruptivo` | `593980004047` |
| **P48** | Stefany Paucar | Quito | Disruptivos: Carreras Inexistentes | `disruptivo` | `593980004048` |
| **P49** | Ricardo Holguín | Manta | Disruptivos: Carreras Inexistentes | `disruptivo` | `593980004049` |
| **P50** | Estela Quinde | Cuenca | Disruptivos: Carreras Inexistentes | `disruptivo` | `593980004050` |
| **P51** | Danny Quimi | Santa Elena | Disruptivos: Cambio de Carrera en Vivo | `disruptivo` | `593980004051` |
| **P52** | Jessica Zambrano | Santo Domingo | Disruptivos: Cambio de Carrera en Vivo | `disruptivo` | `593980004052` |
| **P53** | Pablo Chiluisa | Ambato | Disruptivos: Cambio de Carrera en Vivo | `disruptivo` | `593980004053` |
| **P54** | Roxana Cañizares | Daule | Disruptivos: Cambio de Carrera en Vivo | `disruptivo` | `593980004054` |
| **P55** | Manuel Barrezueta | Machala | Disruptivos: Todo en 1 solo mensaje | `disruptivo` | `593980004055` |
| **P56** | Diana Villacreses | Quito | Disruptivos: Todo en 1 solo mensaje | `disruptivo` | `593980004056` |
| **P57** | Pedro Tomalá | Salinas | Disruptivos: Todo en 1 solo mensaje | `disruptivo` | `593980004057` |
| **P58** | Lucía Carrión | Loja | Disruptivos: Todo en 1 solo mensaje | `disruptivo` | `593980004058` |
| **P59** | Fabricio Palacios | Guayaquil | Disruptivos: Preguntas Académicas Frecuentes | `disruptivo` | `593980004059` |
| **P60** | Martha Córdova | Quito | Disruptivos: Preguntas Académicas Frecuentes | `disruptivo` | `593980004060` |
| **P61** | Gonzalo Tenorio | Esmeraldas | Disruptivos: Preguntas Académicas Frecuentes | `disruptivo` | `593980004061` |
| **P62** | Karina Baldeón | Riobamba | Disruptivos: Preguntas Académicas Frecuentes | `disruptivo` | `593980004062` |
| **P63** | Luis Poma | Cuenca | Disruptivos: Monosílabos y Casos Límite | `disruptivo` | `593980004063` |
| **P64** | Bryan Soria | Ambato | Disruptivos: Monosílabos y Casos Límite | `disruptivo` | `593980004064` |
| **P65** | Holger Cobeña | Puerto Ayora (Galápagos) | Casos Especiales y Regionales (Nuevos 8) | `grado_regular` | `593980004065` |
| **P66** | Jipson Andy | El Coca (Orellana) | Casos Especiales y Regionales (Nuevos 8) | `grado_regular` | `593980004066` |
| **P67** | Cabo Segundo Luis Morales | Quito | Casos Especiales y Regionales (Nuevos 8) | `validacion_pe` | `593980004067` |
| **P68** | Don Gonzalo Astudillo | Cuenca | Casos Especiales y Regionales (Nuevos 8) | `grado_regular` | `593980004068` |
| **P69** | Yadira Quijije | Portoviejo / Queens (NY) | Casos Especiales y Regionales (Nuevos 8) | `maestria_2pasos` | `593980004069` |
| **P70** | Dayana Estupiñán | Esmeraldas | Casos Especiales y Regionales (Nuevos 8) | `disruptivo` | `593980004070` |
| **P71** | Ing. Carlos Julio Paladines | Machala | Casos Especiales y Regionales (Nuevos 8) | `maestria_2pasos` | `593980004071` |
| **P72** | Geovany Pata | Catamayo (Loja) | Casos Especiales y Regionales (Nuevos 8) | `disruptivo` | `593980004072` |

---

## 3. Detalle Completo de Personajes y Guiones de Prueba

### 📂 Alineados: Grado y Bachilleres

#### `P01` · Brayan Holguín — *Guayaquil*
- **Arquetipo:** Joven bachiller que trabaja en taller mecánico en el Guasmo
- **Teléfono Virtual:** `593980004001`
- **Tipo de Flujo:** `grado_regular` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "q tal ñaña buenas... toy interesado en ingenieria en sistemas pero ando en el camello"
T2 > "Brayan Holguin de aca de Guayaquil... sali del colegio hace 2 anos y quiero superarme"
T3 > "Mi cédula para el beneficio es 0902345677 de una ñaña"
T4 > "De una separeme el cupo mi llave"
```

#### `P02` · Doménica Sarango — *Loja*
- **Arquetipo:** Bachiller lojana con vocación para educación primaria
- **Teléfono Virtual:** `593980004002`
- **Tipo de Flujo:** `grado_regular` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes estimada señorita, deseo información de la licenciatura en educación básica"
T2 > "Domenica Sarango desde Loja... acabo de graduarme del colegio de bachiller en ciencias"
T3 > "Mi número de cédula para consultar el beneficio es 1102345673"
T4 > "Sí por favor, sepáreme el cupo con el beneficio de pronto pago"
```

#### `P03` · Wellington Coello — *Babahoyo*
- **Arquetipo:** Emprendedor de Los Ríos en el negocio de granos
- **Teléfono Virtual:** `593980004003`
- **Tipo de Flujo:** `grado_regular` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes licen quiero saber de administracion de empresas"
T2 > "Wellington Coello de Babahoyo... tengo mi negocio propio y quiero el título universitario"
T3 > "Le paso mi cedula para el sistema: 1202345672"
T4 > "Claro que sí licen, apárteme el cupo"
```

#### `P04` · Shirley Tupiza — *Cayambe*
- **Arquetipo:** Joven trabajadora de florícola interesada en finanzas
- **Teléfono Virtual:** `593980004004`
- **Tipo de Flujo:** `grado_regular` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes veci, cuánto cuesta la carrera de contabilidad y auditoría"
T2 > "Shirley Tupiza desde Cayambe veci... trabajo en contabilidad básica en la plantación"
T3 > "Mi número de cédula es 1702345677 para ver el descuento"
T4 > "Por favor veci, ayúdeme apartando el cupo"
```

#### `P05` · Fabricio Mite — *Santa Elena*
- **Arquetipo:** Bachiller peninsular del sector hotelero
- **Teléfono Virtual:** `593980004005`
- **Tipo de Flujo:** `grado_regular` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Habla mi pana buenas, me interesa la carrera de turismo"
T2 > "Fabricio Mite de aca de Santa Elena mi pana... bachiller técnico en hotelería"
T3 > "Claro aquí le paso mi cedula pana: 0902345677"
T4 > "De una mi pana, resérveme ese cupo"
```

#### `P06` · Gissella Cárdenas — *Cuenca*
- **Arquetipo:** Creativa morlaca interesada en publicidad y medios digitales
- **Teléfono Virtual:** `593980004006`
- **Tipo de Flujo:** `grado_regular` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola estimada qué tal, me interesa la carrera de diseño gráfico"
T2 > "Gissella Cardenas desde Cuenca... me gusta la animación y la publicidad"
T3 > "Le paso mi cédula: 0102345675 para que revise el pronto pago"
T4 > "Sí estimada, proceda a apartarme el cupo"
```

#### `P07` · Kleber Zambrano — *El Carmen*
- **Arquetipo:** Joven manabita enfocado en relaciones comunitarias
- **Teléfono Virtual:** `593980004007`
- **Tipo de Flujo:** `grado_regular` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Que tal compa buenas tardes, información de psicología"
T2 > "Kleber Zambrano de aca de El Carmen... soy bachiller recién egresado"
T3 > "Mi cédula compa es 1302345671"
T4 > "Sepáreme el cupo de una vez compa"
```

#### `P08` · Evelyn Guamangate — *Pelileo*
- **Arquetipo:** Trabajadora de confección textil buscando tecnificación
- **Teléfono Virtual:** `593980004008`
- **Tipo de Flujo:** `grado_regular` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes disculpe, quiero averiguar sobre ingeniería industrial"
T2 > "Evelyn Guamangate desde Pelileo... trabajo en control de calidad en confección de jeans"
T3 > "Tome mi cédula señorita: 1802345676"
T4 > "Sí me conviene la cuota pronto pago, resérveme el cupo"
```

#### `P09` · Kevin Piguave — *Durán*
- **Arquetipo:** Técnico de cableado que busca profesionalizarse cerca de casa
- **Teléfono Virtual:** `593980004009`
- **Tipo de Flujo:** `grado_regular` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "wena ñaño kiero info d ingenieria electrica en la UBE"
T2 > "Kevin Piguave d Duran... vivo cerquita del campus km 5 via Yaguachi"
T3 > "Aki te paso la cedula: 0902345677"
T4 > "Bacan ñaño separeme el cupo"
```

#### `P10` · Rosa Chimborazo — *Riobamba*
- **Arquetipo:** Auxiliar de párvulos buscando título de tercer nivel
- **Teléfono Virtual:** `593980004010`
- **Tipo de Flujo:** `grado_regular` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola buenas tardes quiero saber de la licenciatura en educacion inicial en linea"
T2 > "Rosa Chimborazo de Riobamba... bachiller, trabajo como auxiliar de aula"
T3 > "Le paso mi número de cédula: 0602345670"
T4 > "Por favor sepáreme el cupo señorita"
```

### 📂 Alineados: Validación PE

#### `P11` · Gladys Guamán — *Riobamba*
- **Arquetipo:** Profesora fiscal comunitaria con 8 años de trayectoria
- **Teléfono Virtual:** `593980004011`
- **Tipo de Flujo:** `validacion_pe` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `validacion` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes licen, quiero validar mis 8 años de servicio en educación básica"
T2 > "Gladys Guaman de Riobamba... tengo nombramiento provisional y necesito titularme rápido"
T3 > "Mi número de cédula para la validación es 0602345670"
T4 > "Sí licenciada, apárteme el cupo de PE-15"
```

#### `P12` · Nixon Batallas — *Santo Domingo*
- **Arquetipo:** Agente de la CTE tecnólogo en tránsito con 5 años de servicio
- **Teléfono Virtual:** `593980004012`
- **Tipo de Flujo:** `validacion_pe` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `validacion` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Saludos cordiales deseo información de validación en ingeniería en tránsito"
T2 > "Nixon Batallas de Santo Domingo, soy tecnólogo en transporte con 5 años de servicio operativo"
T3 > "Le facilito mi cédula: 1702345677"
T4 > "Excelente, proceda a apartar mi cupo en validación"
```

#### `P13` · Ángel Mero — *Manta*
- **Arquetipo:** Docente de inglés en colegio de Manabí con 6 años de experiencia
- **Teléfono Virtual:** `593980004013`
- **Tipo de Flujo:** `validacion_pe` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `validacion` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hello buenas tardes, deseo validar experiencia para Pedagogía de los Idiomas Nacionales y Extranjeros"
T2 > "Angel Mero de aca de Manta... 6 años dando clases de inglés en colegio fiscal"
T3 > "Mi cédula ecuatoriana es 1302345671"
T4 > "Yes please, confirme mi cupo para el ciclo"
```

#### `P14` · Carmen Yánez — *Ambato*
- **Arquetipo:** Educadora de centro infantil con 7 años de servicio
- **Teléfono Virtual:** `593980004014`
- **Tipo de Flujo:** `validacion_pe` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `validacion` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes estimada, quiero titularme por experiencia en Educación Inicial"
T2 > "Carmen Yanez desde Ambato... 7 años trabajando en centros infantiles del MIES"
T3 > "Le doy mi número de cédula: 1802345676"
T4 > "Sí estimada, ayúdeme congelando el cupo"
```

#### `P15` · Darwin Vera — *Milagro*
- **Arquetipo:** Técnico de seguridad industrial en ingenio azucarero
- **Teléfono Virtual:** `593980004015`
- **Tipo de Flujo:** `validacion_pe` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `validacion` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Saludos cordiales, quiero validar para Seguridad y Salud Ocupacional (SSO)"
T2 > "Darwin Vera de aca de Milagro... 4 años como técnico de prevención en planta azucarera"
T3 > "Mi número de cédula es 0902345677"
T4 > "Correcto, separe mi cupo por favor"
```

#### `P16` · Marcelo Cuenca — *Loja*
- **Arquetipo:** Profesor rural de frontera con 9 años de experiencia
- **Teléfono Virtual:** `593980004016`
- **Tipo de Flujo:** `validacion_pe` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `validacion` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes licenciada, busco el programa PE-15 de Ciencias de la Educación"
T2 > "Marcelo Cuenca desde Loja... docente comunitario en frontera sur por 9 años"
T3 > "Cédula: 1102345673 para registrar el beneficio institucional"
T4 > "Por favor separe mi cupo para iniciar clases"
```

#### `P17` · Geovanny Cedeño — *Chone*
- **Arquetipo:** Jefe de agencia en cooperativa de ahorro con 6 años laborales
- **Teléfono Virtual:** `593980004017`
- **Tipo de Flujo:** `validacion_pe` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `validacion` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes amiga, quiero validar experiencia para Licenciatura en Administración"
T2 > "Geovanny Cedeno de Chone... 6 años como jefe operativo en cooperativa"
T3 > "Mi cédula es 1302345671"
T4 > "Adelante amiga, resérveme el cupo"
```

#### `P18` · Patricia Quishpe — *Ibarra*
- **Arquetipo:** Secretaria de junta parroquial con 5 años de gestión pública
- **Teléfono Virtual:** `593980004018`
- **Tipo de Flujo:** `validacion_pe` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `validacion` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes estimada, deseo validar experiencia laboral en Gestión Pública"
T2 > "Patricia Quishpe desde Ibarra... 5 años como secretaria en junta parroquial"
T3 > "Le brindo mi cédula: 1002345674"
T4 > "Con mucho gusto estimada, resérveme el cupo"
```

### 📂 Alineados: Maestrías 2 Pasos

#### `P19` · Maritza Galarza — *Guayaquil*
- **Arquetipo:** Licenciada en educación buscando maestría afín
- **Teléfono Virtual:** `593980004019`
- **Tipo de Flujo:** `maestria_2pasos` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `maestria` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola buenas tardes, quisiera ver el catálogo de maestrías que tienen"
T2 > "Maritza Galarza de Guayaquil... ya soy licenciada, me interesa el área de Educación"
T3 > "Me llama la atención la Maestría en Pedagogía, mi cédula es 0902345677"
T4 > "Sí sepáreme el cupo de maestría"
```

#### `P20` · Andrés Viteri — *Quito*
- **Arquetipo:** Abogado en libre ejercicio consultando posgrado legal
- **Teléfono Virtual:** `593980004020`
- **Tipo de Flujo:** `maestria_2pasos` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `maestria` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes qué maestrías ofertan actualmente"
T2 > "Andres Viteri desde Quito... soy abogado titulado, me interesa el área de Derecho"
T3 > "La Maestría en Derecho Procesal Penal me conviene, mi cédula es 1702345677"
T4 > "Separe mi cupo estimado"
```

#### `P21` · Lorena Moreira — *Portoviejo*
- **Arquetipo:** Licenciada en enfermería buscando posgrado en salud
- **Teléfono Virtual:** `593980004021`
- **Tipo de Flujo:** `maestria_2pasos` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `maestria` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes deseo conocer los programas de cuarto nivel"
T2 > "Lorena Moreira de Portoviejo... tengo título de tercer nivel en el área de Salud"
T3 > "Me interesa la Maestría en Gestión de Servicios de Salud, mi cédula es 1302345671"
T4 > "Sí amiga, por favor resérveme el cupo"
```

#### `P22` · Santiago Noboa — *Cuenca*
- **Arquetipo:** Ingeniero comercial consultando MBA
- **Teléfono Virtual:** `593980004022`
- **Tipo de Flujo:** `maestria_2pasos` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `maestria` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola estimada, qué posgrados tienen disponibles"
T2 > "Santiago Noboa desde Cuenca... mi título es en Administración y Negocios"
T3 > "El MBA mención Gestión de Proyectos, mi cédula es 0102345675"
T4 > "Proceda a congelar mi cupo estimada"
```

#### `P23` · Andrea Cevallos — *Machala*
- **Arquetipo:** Ingeniera en sistemas buscando maestría tecnológica
- **Teléfono Virtual:** `593980004023`
- **Tipo de Flujo:** `maestria_2pasos` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `maestria` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes quisiera el catálogo de maestrías online"
T2 > "Andrea Cevallos desde Machala... soy ingeniera, me interesa el área de Tecnologías e Ingenierías"
T3 > "La Maestría en Ciberseguridad Aplicada, cédula 0702345679"
T4 > "Sí señorita, sepáreme el cupo de maestría"
```

#### `P24` · Edison Toala — *Daule*
- **Arquetipo:** Docente de colegio buscando maestría en inclusión
- **Teléfono Virtual:** `593980004024`
- **Tipo de Flujo:** `maestria_2pasos` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `maestria` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes deseo información de programas de cuarto nivel"
T2 > "Edison Toala de Daule... trabajo en magisterio, área de Educación"
T3 > "La Maestría en Educación Inclusiva me interesa, cédula 0902345677"
T4 > "Apárteme el cupo estimada"
```

#### `P25` · Cristina Játiva — *Ibarra*
- **Arquetipo:** Doctora en jurisprudencia consultando derecho constitucional
- **Teléfono Virtual:** `593980004025`
- **Tipo de Flujo:** `maestria_2pasos` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `maestria` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Saludos qué maestrías jurídicas tienen disponibles"
T2 > "Cristina Jativa desde Ibarra... abogada en libre ejercicio, área de Derecho"
T3 > "Maestría en Derecho Constitucional, mi cédula es 1002345674"
T4 > "Sí por favor, reserve mi cupo"
```

#### `P26` · Fausto Moncayo — *Latacunga*
- **Arquetipo:** Auditor contable buscando maestría tributaria
- **Teléfono Virtual:** `593980004026`
- **Tipo de Flujo:** `maestria_2pasos` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `maestria` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes qué opciones de cuarto nivel manejan"
T2 > "Fausto Moncayo desde Latacunga... CPA registrado, área de Administración y Finanzas"
T3 > "Maestría en Auditoría y Tributación, cédula 0502345671"
T4 > "Sí proceda con el cupo"
```

#### `P27` · Johanna Villacís — *Ambato*
- **Arquetipo:** Psicóloga buscando posgrado clínico
- **Teléfono Virtual:** `593980004027`
- **Tipo de Flujo:** `maestria_2pasos` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `maestria` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes tienen catálogo de posgrados"
T2 > "Johanna Villacis desde Ambato... psicóloga general, área de Salud"
T3 > "Maestría en Psicoterapia y Salud Mental, cédula 1802345676"
T4 > "Claro que sí, sepáreme el cupo"
```

#### `P28` · Roberto Álava — *Babahoyo*
- **Arquetipo:** Administrador agropecuario buscando maestría en agronegocios
- **Teléfono Virtual:** `593980004028`
- **Tipo de Flujo:** `maestria_2pasos` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `maestria` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Qué tal amiga qué maestrías tienen para el sector productivo"
T2 > "Roberto Alava de Babahoyo... título de tercer nivel en área de Administración"
T3 > "Maestría en Gestión Agroempresarial, cédula 1202345672"
T4 > "De una amiga, reserve el cupo"
```

### 📂 Alineados: Agendamiento Citas

#### `P29` · Jackson Preciado — *Esmeraldas*
- **Arquetipo:** Costeño esmeraldeño que solicita llamada el Lunes
- **Teléfono Virtual:** `593980004029`
- **Tipo de Flujo:** `agendamiento_llamada` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Que fue mi bro buenas, busco informacion de ingenieria en sistemas"
T2 > "Jackson Preciado de aca de Esmeraldas mi llave... ando ocupado en el taller, cuadremos una llamada"
T3 > "El Lunes a las 10:30 am me timbran de una"
```

#### `P30` · Segundo Caiza — *Quito*
- **Arquetipo:** Serrano comerciante que agenda llamada para el Martes
- **Teléfono Virtual:** `593980004030`
- **Tipo de Flujo:** `agendamiento_llamada` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes veci... ayúdeme por favor con información de la carrera de derecho"
T2 > "Segundo Caiza desde Quito... veci preferiría que me llamen por teléfono para coordinar bien"
T3 > "Para el Martes a las 4:30 pm estaría perfecto veci"
```

#### `P31` · Jefferson Intriago — *Chone*
- **Arquetipo:** Manaba ganadero que pacta llamada para el Miércoles
- **Teléfono Virtual:** `593980004031`
- **Tipo de Flujo:** `agendamiento_llamada` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Habla compa buenas tardes, quiero saber de administracion de empresas"
T2 > "Jefferson Intriago de Chone manaba de cepa... ando en la vía, mejor agendemos llamada telefónica"
T3 > "El Miércoles a las 11:15 am me queda preciso compa"
```

#### `P32` · Lourdes Cando — *Cuenca*
- **Arquetipo:** Madre de familia que agenda llamada para el Jueves
- **Teléfono Virtual:** `593980004032`
- **Tipo de Flujo:** `agendamiento_llamada` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes estimada, una consulta sobre enfermería semipresencial"
T2 > "Lourdes Cando desde Cuenca... oiga señorita tengo varias dudas, pueden llamarme por teléfono?"
T3 > "El Jueves a las 2:15 pm por favor"
```

### 📂 Disruptivos: Saltos de Tema y Desorden

#### `P33` · Byron Pincay — *Guayaquil*
- **Arquetipo:** Aspirante guayaco disperso que mezcla preguntas de campus y deportes
- **Teléfono Virtual:** `593980004033`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "hola oye cuanto vale la carrera de sistemas y si hay piscina en el campus duran?"
T2 > "Byron Pincay de Guayaquil... mi prima estudia odontologia alla en duran y dice que es bacan, yo quiero sistemas pero online"
T3 > "oye y si no doy la cedula que pasa? bueno toma: 0902345677"
```

#### `P34` · Yolanda Guamán — *Riobamba*
- **Arquetipo:** Aspirante serrana que salta entre horarios y vida familiar
- **Teléfono Virtual:** `593980004034`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes las clases de educación básica son en la noche? es que tengo dos guaguas pequeños"
T2 > "Yolanda Guaman desde Riobamba... y los exámenes son en línea o toca viajar a Durán? porque el pasaje está caro"
T3 > "Bueno mi cédula es 0602345670 daráme viendo si hay beca"
```

#### `P35` · Cristian Loor — *Manta*
- **Arquetipo:** Futbolista barrial que pregunta por beca y tarjetas
- **Teléfono Virtual:** `593980004035`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "que mas tienen beca deportiva para futbolistas? quiero estudiar derecho"
T2 > "Cristian Loor de Manta... oiga y se puede pagar con la tarjeta de mi tío en diferido?"
T3 > "toma mi cedula man: 1302345671"
```

#### `P36` · Tatiana Mora — *Quito*
- **Arquetipo:** Confundida entre estudiar maestría o segunda carrera
- **Teléfono Virtual:** `593980004036`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola quiero saber si me conviene estudiar otra carrera o mejor una maestría en talento humano"
T2 > "Tatiana Mora de Quito... ya tengo un título en turismo pero no hay trabajo, qué me recomienda?"
T3 > "Cédula 1702345677 para ver qué beneficio tengo"
```

#### `P37` · Jonathan Vaca — *Quevedo*
- **Arquetipo:** Duda entre validar experiencia o empezar desde primer semestre
- **Teléfono Virtual:** `593980004037`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes trabajo en una bananera 3 años, puedo validar en administración o empiezo de cero?"
T2 > "Jonathan Vaca de Quevedo... la verdad no tengo certificados del iess completos, solo cartas patronales"
T3 > "Mi cédula es 1202345672 para que me revise"
```

#### `P38` · Belén Alarcón — *Loja*
- **Arquetipo:** Pregunta carnet estudiantil, convenios y cuotas
- **Teléfono Virtual:** `593980004038`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola el carnet de la UBE sirve para descuento de pasajes interprovinciales?"
T2 > "Belen Alarcon desde Loja... quiero estudiar psicología pero también saber si tienen convenio con clínicas en Loja"
T3 > "Cédula 1102345673"
```

#### `P39` · Washington Solís — *Daule*
- **Arquetipo:** Quiere homologar materias de universidad pública
- **Teléfono Virtual:** `593980004039`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes dejé botada la carrera de derecho en la estatal en 4to semestre, me convalidan?"
T2 > "Washington Solis de aca de Daule... tengo los syllabus firmados"
T3 > "Revíseme con mi cédula 0902345677"
```

#### `P40` · Nicole Peñafiel — *Milagro*
- **Arquetipo:** Consulta para ella y su esposo en el mismo mensaje
- **Teléfono Virtual:** `593980004040`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola quiero información de enfermería para mí y de sistemas para mi esposo, hay descuento en pareja?"
T2 > "Nicole Penafiel de Milagro... los dos queremos estudiar online en las noches"
T3 > "Mi cédula es 0902345677 y la de él termina en 88"
```

### 📂 Disruptivos: Objeciones Duras y Desconfianza

#### `P41` · Carlos Intriago — *Chone*
- **Arquetipo:** Manaba receloso que no quiere dar la cédula
- **Teléfono Virtual:** `593980004041`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Quiero saber cuánto cuesta la carrera de derecho"
T2 > "Carlos Intriago de Chone... pero por qué me pides la cédula si ni te conozco? esto parece estafa"
T3 > "Bueno si es para beneficio institucional tome: 1302345671 pero no me vayan a endeudar"
```

#### `P42` · Mercedes Tenelema — *Guaranda*
- **Arquetipo:** Objeción fuerte por precio comparado con universidad pública
- **Teléfono Virtual:** `593980004042`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Cuánto cobran por la licenciatura en educación?"
T2 > "Mercedes Tenelema desde Guaranda... uy señorita $180 al mes es carísimo, en la pública es gratis"
T3 > "Explíqueme bien lo del pronto pago a ver si me alcanza, cédula 0202345674"
```

#### `P43` · Franklin Coello — *Babahoyo*
- **Arquetipo:** Desconfianza en dar datos por WhatsApp
- **Teléfono Virtual:** `593980004043`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Deseo saber sobre administración de empresas"
T2 > "Franklin Coello de Babahoyo... no me da confianza poner datos privados por chat de whatsapp"
T3 > "Si me garantiza que es seguro le paso la cédula: 1202345672"
```

#### `P44` · Glenda Pilataxi — *Latacunga*
- **Arquetipo:** Rumores de falta de sede física
- **Teléfono Virtual:** `593980004044`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Me interesa psicología pero me dijeron que la UBE no tiene campus propio"
T2 > "Glenda Pilataxi desde Latacunga... cómo sé que es una universidad de verdad y no de papel?"
T3 > "Verifíqueme el beneficio con mi cédula 0502345671"
```

#### `P45` · Javier Macías — *Portoviejo*
- **Arquetipo:** Miedo a penalidades o expulsión por retraso en pagos
- **Teléfono Virtual:** `593980004045`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Información de ingeniería en sistemas por favor"
T2 > "Javier Macias de Portoviejo... si un mes me atraso en pagar la cuota me cobran intereses o me botan del ciclo?"
T3 > "Mi cédula es 1302345671 para revisar los aranceles"
```

#### `P46` · Mónica Reascos — *Tulcán*
- **Arquetipo:** Temor a clonación de identidad y delitos informáticos
- **Teléfono Virtual:** `593980004046`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes qué requisitos piden para enfermería?"
T2 > "Monica Reascos desde Tulcan... cómo sé que ustedes no usan mi cédula para sacar créditos?"
T3 > "Está bien le creo, mi cédula es 0402345672"
```

### 📂 Disruptivos: Carreras Inexistentes

#### `P47` · Jorge Bazurto — *Guayaquil*
- **Arquetipo:** Pide Medicina Humana para ser cirujano (No ofertada)
- **Teléfono Virtual:** `593980004047`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola buenas quiero estudiar Medicina Humana para graduarme de médico cirujano"
T2 > "Jorge Bazurto de Guayaquil... no tienen medicina? qué otra carrera del área de salud me ofrecen?"
T3 > "Enfermería me parece bien, mi cédula es 0902345677"
```

#### `P48` · Stefany Paucar — *Quito*
- **Arquetipo:** Pide Medicina Veterinaria y Zootecnia (No ofertada)
- **Teléfono Virtual:** `593980004048`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes tienen la carrera de Veterinaria y zootecnia?"
T2 > "Stefany Paucar desde Quito... lástima que no tengan animales, qué carreras de ingeniería tienen?"
T3 > "Sistemas Inteligentes me agrada, mi cédula es 1702345677"
```

#### `P49` · Ricardo Holguín — *Manta*
- **Arquetipo:** Pide Gastronomía y Artes Culinarias (No ofertada)
- **Teléfono Virtual:** `593980004049`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Q tal amiga kiero estudiar gastronomia y chef internacional"
T2 > "Ricardo Holguin de Manta... no tienen cocina? y turismo tienen disponible?"
T3 > "Turismo me sirve bastante aca en la playa, cédula 1302345671"
```

#### `P50` · Estela Quinde — *Cuenca*
- **Arquetipo:** Pide Arquitectura Naval e Ingeniería de Minas (No ofertada)
- **Teléfono Virtual:** `593980004050`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes tienen Arquitectura Naval o Ingeniería de Minas?"
T2 > "Estela Quinde desde Cuenca... de las que tienen cuál es la más cercana a tecnología?"
T3 > "Ingeniería Industrial me convence, cédula 0102345675"
```

### 📂 Disruptivos: Cambio de Carrera en Vivo

#### `P51` · Danny Quimi — *Santa Elena*
- **Arquetipo:** Inicia consultando Derecho y cambia a Sistemas Inteligentes
- **Teléfono Virtual:** `593980004051`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes me interesa estudiar Derecho presencial"
T2 > "Danny Quimi de Santa Elena... oiga pensándolo bien prefiero Sistemas Inteligentes online porque viajo mucho"
T3 > "Mi cédula es 0902345677 para apartar Sistemas"
```

#### `P52` · Jessica Zambrano — *Santo Domingo*
- **Arquetipo:** Inicia en Educación Básica y cambia a Psicología
- **Teléfono Virtual:** `593980004052`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola quiero información de educación básica"
T2 > "Jessica Zambrano desde Santo Domingo... sabe qué mejor ayúdeme con Psicología que me apasiona más"
T3 > "Cédula 1702345677"
```

#### `P53` · Pablo Chiluisa — *Ambato*
- **Arquetipo:** Inicia en Enfermería y cambia a Administración de Empresas
- **Teléfono Virtual:** `593980004053`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes información de enfermería"
T2 > "Pablo Chiluisa de Ambato... le tengo fobia a la sangre mejor cámbieme a Administración de Empresas"
T3 > "Mi cédula es 1802345676"
```

#### `P54` · Roxana Cañizares — *Daule*
- **Arquetipo:** Inicia en Biomedicina y cambia a IA y Ciberseguridad
- **Teléfono Virtual:** `593980004054`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola me interesa ingeniería en biomedicina en campus duran"
T2 > "Roxana Canizares de aca de Daule... vi que tienen IA y Ciberseguridad 100% online, mejor esa"
T3 > "Cédula 0902345677"
```

### 📂 Disruptivos: Todo en 1 solo mensaje

#### `P55` · Manuel Barrezueta — *Machala*
- **Arquetipo:** Envía todos los datos juntos en su primer mensaje
- **Teléfono Virtual:** `593980004055`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola soy Manuel Barrezueta de Machala, cédula 0702345679, quiero estudiar Derecho a distancia, dígame costo y sepáreme el cupo"
```

#### `P56` · Diana Villacreses — *Quito*
- **Arquetipo:** Profesional apurada que envía datos completos de maestría en un bloque
- **Teléfono Virtual:** `593980004056`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes mi nombre es Diana Villacreses de Quito cédula 1702345677 soy licenciada en educación y deseo matricularme en la maestría en pedagogía online"
```

#### `P57` · Pedro Tomalá — *Salinas*
- **Arquetipo:** Trabajador que pide validación PE con todos sus datos
- **Teléfono Virtual:** `593980004057`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Que tal soy Pedro Tomala de Salinas cedula 0902345677 tengo 5 anos de experiencia en administracion quiero validar mi titulo rapido"
```

#### `P58` · Lucía Carrión — *Loja*
- **Arquetipo:** Aspirante lojana que manda nombre, ciudad, cédula y carrera de una
- **Teléfono Virtual:** `593980004058`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Saludos cordiales soy Lucia Carrion de Loja cédula 1102345673 bachiller me interesa enfermería semipresencial"
```

### 📂 Disruptivos: Preguntas Académicas Frecuentes

#### `P59` · Fabricio Palacios — *Guayaquil*
- **Arquetipo:** Verifica estatus legal y registro en SENESCYT
- **Teléfono Virtual:** `593980004059`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes el título que emite la UBE está debidamente registrado y avalado por la SENESCYT?"
T2 > "Fabricio Palacios de Guayaquil... es que necesito el título para concurso de méritos en el sector público"
T3 > "Mi cédula es 0902345677 para verificar Sistemas"
```

#### `P60` · Martha Córdova — *Quito*
- **Arquetipo:** Pregunta si las clases son sincrónicas obligatorias o grabadas
- **Teléfono Virtual:** `593980004060`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola buenas tardes las clases en línea son con asistencia obligatoria a una hora fija?"
T2 > "Martha Cordova de Quito... por mis turnos no siempre puedo conectarme en vivo, quedan grabadas?"
T3 > "Cédula 1702345677"
```

#### `P61` · Gonzalo Tenorio — *Esmeraldas*
- **Arquetipo:** Pregunta sobre campus físico y laboratorios en Durán
- **Teléfono Virtual:** `593980004061`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Qué tal tienen campus propio con laboratorios y clínicas para enfermería?"
T2 > "Gonzalo Tenorio de Esmeraldas... me dijeron que queda en Durán en el km 5.5 vía Yaguachi verdad?"
T3 > "Mi cédula es 0802345678"
```

#### `P62` · Karina Baldeón — *Riobamba*
- **Arquetipo:** Pregunta facilidades de pago directo sin entidades bancarias
- **Teléfono Virtual:** `593980004062`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes el pago de las cuotas es directo con la universidad o exigen crédito bancario?"
T2 > "Karina Baldeon desde Riobamba... no tengo tarjeta de crédito, puedo pagar por transferencia o ventanilla?"
T3 > "Cédula 0602345670"
```

### 📂 Disruptivos: Monosílabos y Casos Límite

#### `P63` · Luis Poma — *Cuenca*
- **Arquetipo:** Usuario minimalista que responde solo con monosílabos
- **Teléfono Virtual:** `593980004063`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "hola"
T2 > "derecho"
T3 > "si"
T4 > "0102345675"
T5 > "ok"
```

#### `P64` · Bryan Soria — *Ambato*
- **Arquetipo:** Usuario que inicia con emojis y textos ultra-cortos
- **Teléfono Virtual:** `593980004064`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `N/A` | Cierre Confirmado: `No`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "👋"
T2 > "sistemas"
T3 > "cuanto cuesta"
T4 > "1802345676"
```

### 📂 Casos Especiales y Regionales (Nuevos 8)

#### `P65` · Holger Cobeña — *Puerto Ayora (Galápagos)*
- **Arquetipo:** Guía turístico en Galápagos con internet satelital intermitente buscando carrera asincrónica
- **Teléfono Virtual:** `593980004065`
- **Tipo de Flujo:** `grado_regular` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola buenas tardes Diana... le escribo desde Santa Cruz Galápagos, me interesa Administración pero aquí el internet a veces se va por el clima satelital"
T2 > "Holger Cobeña de Puerto Ayora... ¿las clases son 100% en vivo o puedo ver las grabaciones en la noche?"
T3 > "Excelente, le paso mi cédula de Galápagos para el beneficio de matrícula: 2002345672"
T4 > "Por favor ayúdeme reservando el cupo para este período"
```

#### `P66` · Jipson Andy — *El Coca (Orellana)*
- **Arquetipo:** Operador petrolero amazónico con turnos 14/14 que necesita flexibilidad para exámenes
- **Teléfono Virtual:** `593980004066`
- **Tipo de Flujo:** `grado_regular` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes licenciada, trabajo en campo petrolero en el Coca con turnos 14 días adentro y 14 libres. ¿Puedo estudiar Sistemas así?"
T2 > "Mi nombre es Jipson Andy de acá de Orellana. Necesito saber si los exámenes son en fin de semana"
T3 > "Le paso mi documento para que me revise los costos: 2202345670"
T4 > "Listo confirmado mi cupo licenciada muchas gracias"
```

#### `P67` · Cabo Segundo Luis Morales — *Quito*
- **Arquetipo:** Policía Nacional en servicio activo con pases y traslados frecuentes buscando Licenciatura en Derecho
- **Teléfono Virtual:** `593980004067`
- **Tipo de Flujo:** `validacion_pe` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `validacion` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Estimada Diana buenas noches, soy servidor policial técnico operativo, llevo 6 años en la institución y busco profesionalizarme en Derecho"
T2 > "Soy Luis Morales de la ciudad de Quito. Por mi servicio me rotan de plaza cada cierto tiempo, por eso requiero validar experiencia y estudiar online"
T3 > "Mi número de cédula para el análisis es 1702345677"
T4 > "Por favor procedamos con la reserva y revisión de mi carpeta laboral"
```

#### `P68` · Don Gonzalo Astudillo — *Cuenca*
- **Arquetipo:** Aspirante jubilado de 63 años que desea cumplir su sueño de graduarse de Abogado pero teme a la tecnología
- **Teléfono Virtual:** `593980004068`
- **Tipo de Flujo:** `grado_regular` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buenas tardes señorita Diana. Tengo 63 años, soy jubilado en Cuenca y siempre quise ser Abogado, pero no domino mucho las computadoras. ¿Hay inducción?"
T2 > "Gonzalo Astudillo a sus órdenes mi estimada. Si me tienen paciencia con la plataforma yo le dedico todo el día con gusto"
T3 > "Con mucho gusto señorita, mi cédula es 0102345675 para registrarme"
T4 > "Muchas gracias mi estimada Diana, por favor me aparta el cupito"
```

#### `P69` · Yadira Quijije — *Portoviejo / Queens (NY)*
- **Arquetipo:** Migrante manabita en Nueva York buscando estudiar Maestría en Educación con pagos internacionales
- **Teléfono Virtual:** `593980004069`
- **Tipo de Flujo:** `maestria_2pasos` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `maestria` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola Dianita qué tal! Soy licenciada en ciencias de la educación graduada en Manabí pero radico en Queens NY. Quiero sacar mi maestría online avalada por Senescyt"
T2 > "Yadira Quijije. ¿Puedo pagar las cuotas mensuales con tarjeta de crédito emitida acá en Estados Unidos?"
T3 > "Mi cédula ecuatoriana es 1302345671"
T4 > "Listo mi estimada, de una coordinemos la reserva de la maestría"
```

#### `P70` · Dayana Estupiñán — *Esmeraldas*
- **Arquetipo:** Madre soltera afroecuatoriana consultando por becas del 100%, bono del MIES y convenios sociales
- **Teléfono Virtual:** `593980004070`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Hola buenas... yo tengo carnet de discapacidad del 40% y cobro el bono de desarrollo humano. ¿Tienen beca del 100% o la carrera sale gratis?"
T2 > "Dayana Estupiñán de acá de Esmeraldas... quiero saber la verdad si me van a cobrar mensualidades altas porque mi presupuesto es bien ajustado"
T3 > "Si me aseguran una beca o descuento real les doy mi cédula: 0802345678"
T4 > "Bueno me convenció señorita, agéndeme la información detallada"
```

#### `P71` · Ing. Carlos Julio Paladines — *Machala*
- **Arquetipo:** Profesional con título de pregrado obtenido en Colombia/Perú consultando homologación previa en SENESCYT para maestría
- **Teléfono Virtual:** `593980004071`
- **Tipo de Flujo:** `maestria_2pasos` | **Sigue Guion:** `Sí (Alineado)`
- **Aserciones Esperadas:** Ruta: `maestria` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Buen día Diana. Soy Ingeniero Civil graduado en Colombia con título debidamente apostillado. ¿Puedo ingresar directamente a la Maestría en Gestión de Proyectos?"
T2 > "Carlos Paladines desde Machala El Oro. Mi título ya está en trámite de registro en Senescyt"
T3 > "Mi número de cédula de identidad ecuatoriana es 0702345679"
T4 > "De acuerdo Diana, procedamos con la pre-inscripción y envío de la malla curricular"
```

#### `P72` · Geovany Pata — *Catamayo (Loja)*
- **Arquetipo:** Aspirante lojano ultra-coloquial con jerga popular andina/costeña testeando resistencia NLP
- **Teléfono Virtual:** `593980004072`
- **Tipo de Flujo:** `disruptivo` | **Sigue Guion:** `No (Disruptivo)`
- **Aserciones Esperadas:** Ruta: `grado` | Cierre Confirmado: `Sí`

**Diálogo del Prospecto (WhatsApp):**
```text
T1 > "Habla mi llave buenas tardes... chuta ando buscando una carrera pero que no sea puro floro, algo de computación o redes bien bacán"
T2 > "Geovany Pata de por acá de Catamayo Loja... dígame la firme cuánto hay que soltar de una para entrar"
T3 > "Ya pues ñaña no sea malita mire mi cédula a ver si hay descuento: 1102345673"
T4 > "Ya chévere de una guarde el cupo"
```

---

## 4. Los 8 Nuevos Personajes Complementarios (P65 a P72)

> [!NOTE]
> Estos 8 personajes complementan la suite original de 64 para cubrir nichos geográficos estratégicos (Galápagos, Amazonía Petrolera, Policía Nacional en servicio, Adultos Mayores jubilados, Ecuatorianos en el Exterior, Discapacidad/Bono social, Convalidación de Título Extranjero y Lenguaje Coloquial Extremo).

| ID | Personaje | Región / Contexto | Caso Específico Evaluado |
| :---: | :--- | :--- | :--- |
| **P65** | Holger Cobeña | Puerto Ayora, Galápagos | Conectividad satelital y modalidad 100% asincrónica grabada. |
| **P66** | Jipson Andy | El Coca, Orellana | Turnos petroleros 14/14 y flexibilidad de fechas para evaluaciones. |
| **P67** | Luis Morales | Quito / Policía Nacional | Servidor policial con traslados continuos y validación de experiencia. |
| **P68** | Gonzalo Astudillo | Cuenca | Adulto mayor (63 años) jubilado con temor al uso de plataformas virtuales. |
| **P69** | Yadira Quijije | Queens, NY (Migrante) | Docente ecuatoriana en el exterior pagando con tarjeta internacional. |
| **P70** | Dayana Estupiñán | Esmeraldas | Solicitud de beca 100%, bono del MIES y presupuesto vulnerable. |
| **P71** | Carlos Paladines | Machala | Profesional con pregrado en el exterior (Colombia) en trámite de SENESCYT. |
| **P72** | Geovany Pata | Catamayo, Loja | Resistencia de procesamiento de lenguaje natural ante jerga callejera. |

---

## 5. Instrucciones de Ejecución

### Opción 1: Ejecución Masiva por CLI
```bash
# Ejecutar los primeros 10 personajes
docker exec ube-wa-bot node test-bateria.js --limit=10

# Ejecutar filtrando por categoría (ej. disruptivos)
docker exec ube-wa-bot node test-bateria.js --tipo=disruptivo

# Ejecutar la suite completa de 72 casos
docker exec ube-wa-bot node test-bateria.js --limit=72
```

### Opción 2: Prueba en el Simulador Web
1. Ingresa a **http://localhost:3000** en tu navegador.
2. En el panel de simulación, copia y pega los mensajes de cualquiera de los 72 personajes.
3. Verifica cómo Diana detecta automáticamente el nombre, la ciudad, clasifica la carrera y solicita la cédula vinculada a un beneficio.