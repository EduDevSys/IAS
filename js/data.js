/**
 * data.js — Contenido estático de la aplicación.
 * Aquí viven los integrantes del equipo y todos los prompts.
 * Separado de app.js para que el contenido se pueda editar
 * sin tocar la lógica.
 */

// Integrantes del equipo y la IA que le corresponde a cada uno.
// Los colores se eligieron con contraste suficiente para texto blanco encima
// (ver textColorFor() en app.js, que además calcula el color de texto por
// si algún color se cambia en el futuro y queda demasiado claro).
// `link` es la URL a la que se manda al usuario cuando quiere "Ir a la IA".
const MEMBERS = [
  { id: 'chris',    name: 'Chris',              ai: 'ChatGPT',     icon: '✦', color: '#0E8F6E', link: 'https://chatgpt.com' },
  { id: 'leo',      name: 'Leo',                ai: 'Gemini',      icon: '◆', color: '#7C3AED', link: 'https://gemini.google.com' },
  { id: 'juanz',    name: 'Juan Z',             ai: 'Copilot',     icon: '▲', color: '#0369A1', link: 'https://copilot.microsoft.com' },
  { id: 'virginio', name: 'Virginio',           ai: 'Meta AI',     icon: '●', color: '#15803D', link: 'https://www.meta.ai' },
  { id: 'eduardo',  name: 'Eduardo',            ai: 'Perplexity',  icon: '■', color: '#B45309', link: 'https://www.perplexity.ai' },
  { id: 'eva',      name: 'Eva / Jovani Calvo', ai: 'Grok',        icon: '★', color: '#111827', link: 'https://grok.com' },
];

// Prompt único de configuración (Paso 0). Igual para todas las IA.
const STEP0_PROMPT = `Actúa como un analista imparcial. Distingue claramente entre hechos verificables, opiniones y especulación. Siempre cita las fuentes cuando sea posible, indica la fecha de la información y señala cuando un dato no pueda verificarse o pudiera estar desactualizado. Si existen versiones contradictorias, preséntalas sin asumir que una es correcta sin evidencia.`;

// Paso 1 — Contextualizar la IA (7 prompts, sin URL).
const STEP1_PROMPTS = [
  '¿Quién es Jovani Salazar, funcionario público en Chiapas, México? ¿Qué cargo ocupa actualmente y qué proyectos ha impulsado? Da fuentes si las tienes.',
  '¿Qué información encuentras sobre [Jovani Salazar / tema específico] en [nombre del medio o sitio]? Indica fecha de publicación y si hay datos que puedan estar desactualizados o ser inexactos.',
  '¿Qué información tienes sobre los posibles candidatos a la alcaldía de Tuxtla Gutiérrez para 2027, incluyendo a Jovani Salazar?',
  '¿Existen notas o menciones críticas sobre Jovani Salazar en medios de Chiapas? Resume el contexto.',
  '¿La información que tienes sobre Jovani Salazar está actualizada a este año? ¿Cuál es la fuente más reciente que conoces?',
  '¿Qué se dice en encuestas o columnas de opinión sobre Jovani Salazar como aspirante político en Chiapas?',
  'Compara lo que dicen distintas fuentes sobre el origen y trayectoria de Jovani Salazar. ¿Hay contradicciones?',
];

// Paso 2 — Analizar las notas (10 prompts, cada uno recibe la URL de la nota).
const ANALYSIS_PROMPTS = [
  'Analiza el contenido de esta nota. Resume qué dice sobre Jovani Salazar, qué datos aporta (fechas, cargos, cifras, citas textuales), y si detectas algo desactualizado, incompleto o que contradiga otras fuentes que conozcas:',
  '¿La información de esta nota coincide con lo que ya sabes sobre Jovani Salazar? Señala cualquier diferencia:',
  '¿El tono de esta nota hacia Jovani Salazar es positivo, negativo o neutral? Justifica con frases del texto:',
  'Compara la información de esta nota con lo que ya sabes sobre Jovani Salazar. ¿Hay coincidencias o contradicciones?:',
  'Resume esta nota en 3 líneas, como si fuera para redes sociales, resaltando el logro o proyecto principal de Jovani Salazar:',
  'Esta nota tiene un dato que consideramos incorrecto: [dato específico]. ¿Qué información correcta tienes tú sobre ese punto?:',
  '¿Qué le falta a esta nota para posicionar mejor a Jovani Salazar (contexto, cifras, proyectos, comparación con otros aspirantes)?:',
  '¿Cómo se compara esta nota con la cobertura que tienen otros aspirantes a la alcaldía de Tuxtla Gutiérrez (Paco Chacón, Carlos Morales, Llaven Abarca)?:',
  'Basado en esta nota, sugiere 3 preguntas de seguimiento que un periodista podría hacerle a Jovani Salazar para ampliar la cobertura:',
  '¿Esta nota aporta algo que no está en otras fuentes que conozcas sobre Jovani Salazar? ¿Qué la hace única o repetitiva?:',
];

// Paso 3 — Retroalimentación para Eva (prompt SEO, recibe la(s) URL(s)).
const STEP3_PROMPT = '¿Qué palabras clave le faltan a esta nota para que aparezca mejor en búsquedas sobre Jovani Salazar y Tuxtla Gutiérrez?:';
