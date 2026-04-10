/** Catálogo demo de clientes — separado de `Clientes.tsx` para evitar import circular com `mediaManagementStore`. */

export type Client = {
  id: number;
  name: string;
  segment: string;
  email: string;
  cnpj: string;
  spend: string;
  spendNumeric: number;
  roi: string;
  status: "Ativo" | "Pausado";
  platforms: string[];
  budgetLabel: string;
  leads: number;
  conversions: number;
  leadsChangePct: number;
  convChangePct: number;
  impressions: number;
  clicks: number;
  cpa: number;
  cpc: number;
  cpm: number;
  ctr: number;
  aiInsight: string;
};

export const clientsData: Client[] = [
  {
    id: 1,
    name: "Tech Solutions",
    segment: "SaaS",
    email: "contato@techflow.com.br",
    cnpj: "12.345.678/0001-90",
    spend: "R$ 18.500",
    spendNumeric: 18500,
    roi: "4.2x",
    status: "Ativo",
    platforms: ["Meta", "Google"],
    budgetLabel: "R$ 20.000/mês",
    leads: 420,
    conversions: 352,
    leadsChangePct: 5.2,
    convChangePct: -2.1,
    impressions: 890000,
    clicks: 12200,
    cpa: 52.6,
    cpc: 1.52,
    cpm: 20.8,
    ctr: 1.37,
    aiInsight:
      "CPL em Meta Ads subiu 12% na última semana; Google Search mantém melhor CPA. Sugestão: realocar 10% do orçamento de Display para Search de marca.",
  },
  {
    id: 2,
    name: "Bella Cosméticos",
    segment: "Beleza & Estética",
    email: "marketing@bellacosmeticos.com.br",
    cnpj: "45.678.901/0001-23",
    spend: "R$ 12.300",
    spendNumeric: 12300,
    roi: "3.8x",
    status: "Ativo",
    platforms: ["Instagram", "Meta"],
    budgetLabel: "R$ 25.000/mês",
    leads: 685,
    conversions: 278,
    leadsChangePct: 8.2,
    convChangePct: -3.2,
    impressions: 2100000,
    clicks: 98000,
    cpa: 44.2,
    cpc: 0.13,
    cpm: 5.86,
    ctr: 4.67,
    aiInsight:
      "Instagram apresenta CPL 2× acima da média do mix; Reels convertem melhor que Feed. Priorizar criativos de vídeo e testar orçamento em campanhas de conversão no Meta.",
  },
  {
    id: 3,
    name: "AutoPrime Veículos",
    segment: "Automotivo",
    email: "ads@autoprime.com.br",
    cnpj: "33.222.111/0001-44",
    spend: "R$ 25.000",
    spendNumeric: 25000,
    roi: "2.9x",
    status: "Ativo",
    platforms: ["Google", "Meta"],
    budgetLabel: "R$ 30.000/mês",
    leads: 310,
    conversions: 198,
    leadsChangePct: -1.4,
    convChangePct: 4.5,
    impressions: 1200000,
    clicks: 18500,
    cpa: 63.1,
    cpc: 1.35,
    cpm: 20.83,
    ctr: 1.54,
    aiInsight:
      "CPA elevado em campanhas de remarketing no Google; audiências estão amplas demais. Refinar exclusões e reduzir lances em palavras genéricas.",
  },
  {
    id: 4,
    name: "FitLife Solutions",
    segment: "Fitness",
    email: "growth@fitlife.com.br",
    cnpj: "11.222.333/0001-55",
    spend: "R$ 5.800",
    spendNumeric: 5800,
    roi: "5.1x",
    status: "Ativo",
    platforms: ["Instagram"],
    budgetLabel: "R$ 8.000/mês",
    leads: 290,
    conversions: 142,
    leadsChangePct: 12.0,
    convChangePct: 6.1,
    impressions: 450000,
    clicks: 11200,
    cpa: 40.8,
    cpc: 0.52,
    cpm: 12.89,
    ctr: 2.49,
    aiInsight:
      "Performance estável; CTR acima da média do setor. Oportunidade de escalar orçamento em anúncios de carrossel com prova social.",
  },
  {
    id: 5,
    name: "Gourmet Express",
    segment: "Food Delivery",
    email: "parceiros@gourmetexpress.com.br",
    cnpj: "98.765.432/0001-10",
    spend: "R$ 8.200",
    spendNumeric: 8200,
    roi: "3.5x",
    status: "Pausado",
    platforms: ["Meta", "Instagram"],
    budgetLabel: "R$ 10.000/mês",
    leads: 180,
    conversions: 95,
    leadsChangePct: -4.0,
    convChangePct: -8.0,
    impressions: 620000,
    clicks: 7400,
    cpa: 86.3,
    cpc: 1.11,
    cpm: 13.23,
    ctr: 1.19,
    aiInsight:
      "Campanhas pausadas com CPA histórico alto em horários de pico. Ao retomar, limitar entrega a raio menor e horários com melhor histórico de pedidos.",
  },
  {
    id: 6,
    name: "EduSmart Cursos",
    segment: "Educação",
    email: "media@edusmart.com.br",
    cnpj: "55.444.333/0001-66",
    spend: "R$ 15.700",
    spendNumeric: 15700,
    roi: "4.6x",
    status: "Ativo",
    platforms: ["Google", "Meta", "Instagram"],
    budgetLabel: "R$ 18.000/mês",
    leads: 512,
    conversions: 401,
    leadsChangePct: 3.1,
    convChangePct: 1.8,
    impressions: 1500000,
    clicks: 42000,
    cpa: 39.2,
    cpc: 0.37,
    cpm: 10.47,
    ctr: 2.8,
    aiInsight:
      "Mix equilibrado entre canais; YouTube no Google puxa volume com CPA aceitável. Testar anúncios de resposta no Meta para leads quentes.",
  },
  {
    id: 7,
    name: "Habitat Imóveis",
    segment: "Imobiliário",
    email: "digital@habitatimoveis.com.br",
    cnpj: "22.333.444/0001-77",
    spend: "R$ 22.400",
    spendNumeric: 22400,
    roi: "2.7x",
    status: "Ativo",
    platforms: ["Google", "Meta"],
    budgetLabel: "R$ 28.000/mês",
    leads: 198,
    conversions: 112,
    leadsChangePct: -2.0,
    convChangePct: -5.5,
    impressions: 980000,
    clicks: 8800,
    cpa: 200.0,
    cpc: 2.55,
    cpm: 22.86,
    ctr: 0.9,
    aiInsight:
      "CPA muito alto vs. ticket médio do lead. Revisar qualificação de formulário e excluir palavras de aluguel nas campanhas de compra.",
  },
  {
    id: 8,
    name: "PetHappy Store",
    segment: "Pet Shop",
    email: "loja@pethappy.com.br",
    cnpj: "77.888.999/0001-88",
    spend: "R$ 6.900",
    spendNumeric: 6900,
    roi: "4.0x",
    status: "Ativo",
    platforms: ["Instagram", "Meta"],
    budgetLabel: "R$ 9.500/mês",
    leads: 340,
    conversions: 205,
    leadsChangePct: 6.5,
    convChangePct: 4.2,
    impressions: 720000,
    clicks: 15100,
    cpa: 33.7,
    cpc: 0.46,
    cpm: 9.58,
    ctr: 2.1,
    aiInsight:
      "Instagram com melhor ROAS no catálogo; considerar Advantage+ Shopping com orçamento mínimo estável por 14 dias para o algoritmo aprender.",
  },
];
