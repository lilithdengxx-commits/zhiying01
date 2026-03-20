const express = require('express')
const cors = require('cors')
const cron = require('node-cron')
const { scrapeLatest } = require('./scrapers/ccgp')

const app = express()
app.use(cors())
app.use(express.json())

// ============================================================
// 爬虫状态与实时数据缓存
// ============================================================
function mapStatus(typeText) {
  if (!typeText) return 'bidding'
  if (typeText.includes('中标') || typeText.includes('成交') || typeText.includes('结果')) return 'awarded'
  if (typeText.includes('废标') || typeText.includes('终止') || typeText.includes('异常')) return 'failed'
  if (typeText.includes('意向') || typeText.includes('公示')) return 'intention'
  return 'bidding'
}

let crawlerStatus = {
  running: false,
  lastRun: null,
  lastSuccess: null,
  totalFetched: 0,
  error: null,
}
// 从政府采购网实时抓取的标讯（追加到 bids 末尾）
let ccgpBids = []

async function runCrawler() {
  if (crawlerStatus.running) {
    console.log('[CCGP] 爬虫正在运行中，跳过本次触发')
    return
  }
  crawlerStatus.running = true
  crawlerStatus.lastRun = new Date().toISOString()
  crawlerStatus.error = null
  console.log('[CCGP] ── 开始抓取中国政府采购网数据 ──')
  try {
    const items = await scrapeLatest()
    // 转换为 bid 格式，按 ID 去重（保留已有人工数据）
    const existingIds = new Set([...bids.map(b => b.id), ...ccgpBids.map(b => b.id)])
    const newBids = items
      .filter(item => !existingIds.has(item.id))
      .map(item => ({
        id: item.id,
        title: item.fullTitle,
        amount: item.budget,
        region: item.region,
        city: item.city,
        status: mapStatus(item.typeText),
        publishedAt: item.publishedAt,
        deadline: null,
        department: item.dept,
        source: '中国政府采购网 (ccgp.gov.cn)',
        sourceUrl: item.sourceUrl,
        description: `公告类型：${item.typeText}。通过关键词实时抓取自政府采购网。`,
        hasSubcontract: false,
        competitors: [],
        winner: (item.typeText && (item.typeText.includes('中标') || item.typeText.includes('成交'))) ? '（待确认）' : null,
        score: item.score,
        nextAction: item.score >= 80
          ? `高优先级：立即安排商务联系 ${item.dept}`
          : `跟进观察：${item.dept} 项目已录入线索池`,
        isRealtime: true,
      }))
    // 将高分条目同时推进线索池
    const existingLeadIds = new Set(leads.map(l => l.id))
    for (const bid of newBids) {
      if (bid.score >= 70 && !existingLeadIds.has(bid.id)) {
        leads.push({
          id: bid.id,
          title: bid.title,
          type: 'bidding',
          typeName: '招采动作',
          typeColor: 'blue',
          score: bid.score,
          scoreReason: `由政府采购网实时抓取，关键词匹配度高。公告类型：${bid.status}`,
          summary: bid.description,
          source: bid.source,
          sourceUrl: bid.sourceUrl,
          region: bid.region,
          city: bid.city,
          status: 'pending',
          createdAt: bid.publishedAt,
          updatedAt: new Date().toISOString().split('T')[0],
          nextAction: bid.nextAction,
          budget: bid.amount,
          department: bid.department,
          contact: null,
          contactRole: null,
          tags: ['实时抓取', '政采网', bid.region],
          deadline: null,
          isRealtime: true,
        })
        existingLeadIds.add(bid.id)
      }
    }
    ccgpBids.push(...newBids)
    crawlerStatus.totalFetched += newBids.length
    crawlerStatus.lastSuccess = new Date().toISOString()
    console.log(`[CCGP] ── 完成，新增 ${newBids.length} 条标讯，线索池已同步 ──`)
  } catch (err) {
    crawlerStatus.error = err.message
    console.error('[CCGP] 爬虫异常:', err.message)
  } finally {
    crawlerStatus.running = false
  }
}

// 启动时立即执行一次；此后每 30 分钟定时抓取
setTimeout(runCrawler, 3000)
cron.schedule('*/30 * * * *', runCrawler)

// ============================================================
// 模拟数据 · 线索库
// ============================================================
const leads = [
  {
    id: 'L001', title: '广州市政务数据局大数据治理平台建设项目',
    type: 'bidding', typeName: '招采动作', typeColor: 'blue', score: 94,
    scoreReason: '明确采购预算800万，建设内容（数据目录/数据质量/数据湖）与我司核心产品高度契合；采购意向已公示，窗口期约2周；无明显偏向友商参数。',
    summary: '广州市政务数据局发布采购意向公示，拟建设覆盖47个委办局的统一大数据治理平台，预算800万元，技术要求含数据目录、数据质量、数据安全三大核心功能模块。',
    source: '广东省政府采购网', region: '广东省', city: '广州市',
    status: 'pending', createdAt: '2026-03-21', updatedAt: '2026-03-21',
    nextAction: '立即联系广州局采购处王处长，确认技术需求细节并预约方案汇报',
    budget: 800, department: '广州市政务数据局',
    contact: '王建国', contactRole: '采购处处长',
    tags: ['大数据', '数据治理', '华南区', '近期招标'], deadline: '2026-04-05',
  },
  {
    id: 'L002', title: '成都市数字政府AI大模型平台专项规划跟进',
    type: 'policy', typeName: '政策驱动', typeColor: 'green', score: 78,
    scoreReason: '成都市《数字政府2.0行动方案》明确提出2026年底前建设政务AI大模型，与我司核心产品高度匹配；但预算尚未确认，需实地摸底资金落地情况。',
    summary: '成都市发布《成都市数字政府2.0三年行动方案（2025-2027）》，明确建设政务AI大模型平台赋能40+委办局，由市大数据局统筹牵头。',
    source: '成都市人民政府官网', region: '四川省', city: '成都市',
    status: 'contacting', createdAt: '2026-03-20', updatedAt: '2026-03-21',
    nextAction: '本周预约成都市大数据局规划处李处长，摸底专项资金到位情况',
    budget: null, department: '成都市大数据局',
    contact: '李明远', contactRole: '规划处处长',
    tags: ['AI大模型', '数字政府', '西南区'], deadline: null,
  },
  {
    id: 'L003', title: '深圳市南山区政务云平台二期扩容升级',
    type: 'renewal', typeName: '二次商机', typeColor: 'purple', score: 91,
    scoreReason: '现有平台已运营2.5年，合同维保到期在即；客情基础极好（甲方主任已确认意向）；二期明确新增AI辅助决策模块，是我司大模型产品的绝佳切入点。',
    summary: '南山区政务服务数据管理局一期大数据平台（我司承建）已运行2.5年，区领导明确要求2026年Q2前完成二期扩容，新增AI辅助决策、数据要素流通等能力。',
    source: '内部CRM老客户维护记录', region: '广东省', city: '深圳市',
    status: 'contacting', createdAt: '2026-03-18', updatedAt: '2026-03-21',
    nextAction: '本周五前提交《二期建设方案建议书》，并安排高层互访确认立项计划',
    budget: 1200, department: '南山区政务服务数据管理局',
    contact: '陈志强', contactRole: '副局长',
    tags: ['老客户', '二次商机', '大模型', '华南区'], deadline: '2026-05-01',
  },
  {
    id: 'L004', title: '重庆市渝北区智慧城市大数据底座分包商机（华为总包）',
    type: 'subcontract', typeName: '友商分包', typeColor: 'orange', score: 82,
    scoreReason: '华为云中标渝北区智慧城市总包（3.5亿），标书中大数据治理模块（预算约1500万）与我司能力高度匹配；华为在重庆有引入分包的先例。',
    summary: '华为技术有限公司中标重庆市渝北区智慧城市建设EPC总包项目（3.5亿），标书中明确大数据治理、数字孪生两个子模块采用分包模式采购。',
    source: '重庆市公共资源交易中心中标公告', region: '重庆市', city: '重庆市',
    status: 'pending', createdAt: '2026-03-19', updatedAt: '2026-03-20',
    nextAction: '联系华为重庆政务云负责人赵总，确认分包计划和我司介入可行性',
    budget: 1500, department: '重庆市渝北区智慧城市建设指挥部/华为技术有限公司（总包）',
    contact: '赵磊', contactRole: '华为重庆政务云总监',
    tags: ['分包', '智慧城市', '华为生态', '西南区'], deadline: '2026-04-15',
  },
  {
    id: 'L005', title: '山东省数据要素市场化交易平台建设项目',
    type: 'budget', typeName: '预算专项', typeColor: 'gold', score: 88,
    scoreReason: '山东省财政厅2026年专项债资金已到位（8000万），省大数据局2025年底已完成规划评审，落地确定性强；建设内容与我司数据要素产品线高度吻合。',
    summary: '山东省大数据局承接省财政厅8000万专项资金，推进全省统一数据要素市场化交易平台建设，包含数据产品登记、数据交易撮合、数据资产评估三大子系统。',
    source: '山东省财政厅预算公开报告 + 山东省大数据局官网', region: '山东省', city: '济南市',
    status: 'contacting', createdAt: '2026-03-17', updatedAt: '2026-03-20',
    nextAction: '下周二赴济南拜访省大数据局孙副局长，携带数据要素产品Demo',
    budget: 8000, department: '山东省大数据局',
    contact: '孙立新', contactRole: '省大数据局副局长',
    tags: ['数据要素', '专项债', '华东区', '高优先级'], deadline: '2026-04-30',
  },
  {
    id: 'L006', title: '北京市海淀区卫健委公共卫生大数据平台',
    type: 'bidding', typeName: '招采动作', typeColor: 'blue', score: 71,
    scoreReason: '招标公告已发布，但评分标准中有"已与海淀区有合作项目加5分"的要求，中软国际在海淀有存量项目，对我司存在一定壁垒。',
    summary: '海淀区卫生健康委员会发布招标公告，拟建设公共卫生大数据预警平台，预算600万，要求承建方有同类医疗大数据项目案例。',
    source: '北京市政府采购网', region: '北京市', city: '北京市',
    status: 'pending', createdAt: '2026-03-21', updatedAt: '2026-03-21',
    nextAction: '研究评分标准，评估是否有竞争力，若参与需提前一周准备医疗大数据案例材料',
    budget: 600, department: '海淀区卫生健康委员会',
    contact: null, contactRole: null,
    tags: ['医疗大数据', '华北区', '评估中'], deadline: '2026-03-31',
  },
  {
    id: 'L007', title: '杭州市拱墅区某局调任局长引发新系统建设意向',
    type: 'personnel', typeName: '人事异动', typeColor: 'cyan', score: 75,
    scoreReason: '老客户西湖区刘局长调任拱墅区大数据局局长，其在西湖区对我司评价极高，调任新岗位后有强烈意愿推进新系统建设，属高质量隐性线索。',
    summary: '原杭州市西湖区大数据局刘勇局长（我司西湖区平台一期甲方）已正式调任拱墅区大数据局局长，据内部联系人透露，刘局到任后已提出今年建设统一数据共享交换平台的意向。',
    source: '杭州市政府官网人事任免公告 + 内部联系人', region: '浙江省', city: '杭州市',
    status: 'contacting', createdAt: '2026-03-15', updatedAt: '2026-03-18',
    nextAction: '安排高管与刘局进行一次非正式拜会，建立新岗位初期的关系纽带',
    budget: null, department: '杭州市拱墅区大数据局',
    contact: '刘勇', contactRole: '局长（原西湖区老客户）',
    tags: ['人事异动', '人脉拓展', '华东区'], deadline: null,
  },
  {
    id: 'L008', title: '武汉市政务服务局一网通办平台智能化改造',
    type: 'policy', typeName: '政策驱动', typeColor: 'green', score: 65,
    scoreReason: '政策方向明确，但武汉市今年财政预算偏紧，项目可能延后至Q3。腾讯云在武汉有强势布局，需评估竞争难度。',
    summary: '武汉市政务服务和大数据管理局发布《2026年数字政府工作要点》，明确推进一网通办平台AI升级，引入智能审批、智能客服等能力，计划择机采购。',
    source: '武汉市政务服务局官网', region: '湖北省', city: '武汉市',
    status: 'pending', createdAt: '2026-03-16', updatedAt: '2026-03-16',
    nextAction: '列入观察，2026年Q2再跟进预算计划确认情况',
    budget: null, department: '武汉市政务服务和大数据管理局',
    contact: null, contactRole: null,
    tags: ['一网通办', 'AI改造', '中南区', '观察期'], deadline: null,
  },
  {
    id: 'L009', title: '福建省数字政府大模型能力底座集采项目',
    type: 'bidding', typeName: '招采动作', typeColor: 'blue', score: 87,
    scoreReason: '省级统一集采，影响力大；采购意向明确提出"本地化部署大模型"要求，与我司私有化产品线高度契合；竞争对手中缺少具备省级案例的本地大模型厂商。',
    summary: '福建省大数据管理局发布2026年度政务AI大模型能力底座集中采购公示，计划统一采购并部署可供全省40个省直部门调用的政务专用大模型底座，预算3200万。',
    source: '福建省政府采购网', region: '福建省', city: '福州市',
    status: 'contacting', createdAt: '2026-03-14', updatedAt: '2026-03-19',
    nextAction: '已安排下周三技术对接，需提前准备大模型省级部署方案和性能测试报告',
    budget: 3200, department: '福建省大数据管理局',
    contact: '张鹏飞', contactRole: '技术处副处长',
    tags: ['大模型', '省级集采', '华东区', '跟进中'], deadline: '2026-04-20',
  },
  {
    id: 'L010', title: '某大型展会获取：南京市栖霞区智慧园区数据中台需求',
    type: 'exhibition', typeName: '展会活动', typeColor: 'magenta', score: 58,
    scoreReason: '展会交流阶段，线索较初级；对方表达了兴趣但未明确预算和时间节点，需进一步筛选确认是否为真实需求。',
    summary: '在2026中国数字政府大会上，南京市栖霞区经济发展局信息化负责人主动咨询，表达了为高新区建设统一数据中台的想法，但未透露具体预算。',
    source: '2026中国数字政府大会（линд期）', region: '江苏省', city: '南京市',
    status: 'pending', createdAt: '2026-03-10', updatedAt: '2026-03-10',
    nextAction: '发送产品介绍资料，安排一次30分钟线上摸底交流',
    budget: null, department: '南京市栖霞区经济发展局',
    contact: '周小华', contactRole: '信息化科科长',
    tags: ['展会线索', '华东区', '待确认'], deadline: null,
  },
  {
    id: 'L011', title: '内蒙古自治区农业农村厅智慧农业大数据平台',
    type: 'budget', typeName: '预算专项', typeColor: 'gold', score: 80,
    scoreReason: '中央农业数字化专项拨款已到位4000万，内蒙古农业厅已启动采购规划；竞争格局相对空白，是拓展新赛道的稀缺窗口期。',
    summary: '内蒙古自治区农业农村厅获得中央数字农业专项资金4000万元，计划2026年内完成智慧农业大数据平台建设，涵盖农业物联网、农产品溯源、农业生产预警三大模块。',
    source: '农业农村部官网财政拨款公告', region: '内蒙古', city: '呼和浩特市',
    status: 'pending', createdAt: '2026-03-20', updatedAt: '2026-03-21',
    nextAction: '评估是否需专门拓展农业行业赛道，若决策确认，本月内安排初次接触',
    budget: 4000, department: '内蒙古自治区农业农村厅',
    contact: null, contactRole: null,
    tags: ['智慧农业', '专项资金', '北方区'], deadline: null,
  },
  {
    id: 'L012', title: '上海市静安区政务数据共享交换平台废标重招',
    type: 'bidding', typeName: '招采动作', typeColor: 'blue', score: 83,
    scoreReason: '第一次因技术评审分歧废标（无明显控标），二次招标评分标准更公平；我司已提前完成竞品对比分析，竞争优势明显。',
    summary: '上海市静安区大数据中心数据共享交换平台采购项目因技术分歧发出废标公告，现已重新修订采购需求并发布二次招标，预算调整至900万。',
    source: '上海市政府采购云平台', region: '上海市', city: '上海市',
    status: 'filed', createdAt: '2026-03-12', updatedAt: '2026-03-20',
    nextAction: '已立项跟进，华东区交付团队本周完成投标方案初稿',
    budget: 900, department: '上海市静安区大数据中心',
    contact: '吴建波', contactRole: '项目处处长',
    tags: ['废标重招', '已立项', '华东区'], deadline: '2026-04-10',
  },
  {
    id: 'L013', title: '贵州省大数据发展管理局脱敏数据开放平台',
    type: 'policy', typeName: '政策驱动', typeColor: 'green', score: 62,
    scoreReason: '贵州作为大数据先行区政策积极，但本地供应商生态壁垒较深（美亚柏科等强势）。需要评估是否值得投入资源拓展。',
    summary: '贵州省大数据局发布《贵州省公共数据开放工作方案》，明确2026年底前建设省级脱敏数据开放平台，逐步推进政务数据向社会开放。',
    source: '贵州省大数据发展管理局官网', region: '贵州省', city: '贵阳市',
    status: 'pending', createdAt: '2026-03-08', updatedAt: '2026-03-08',
    nextAction: '评估贵州市场竞争格局，确认是否纳入2026年优先拓展区域',
    budget: null, department: '贵州省大数据发展管理局',
    contact: null, contactRole: null,
    tags: ['数据开放', '西南区', '待评估'], deadline: null,
  },
  {
    id: 'L014', title: '南昌市公安局警务大数据综合应用平台',
    type: 'manual', typeName: '手工录入', typeColor: 'default', score: 85,
    scoreReason: '通过行业峰会高层引荐获取; 南昌公安已完成初步方案论证（内部已立项）；决策关键人已明确表达合作意向，成单概率极高。',
    summary: '通过省公安厅大数据局王局引荐，南昌市公安局分管信息化的副局长张副局长邀约方案交流，该项目已完成内部立项，预算1800万，拟于5月发布招标。',
    source: '行业峰会高层引荐（手工录入）', region: '江西省', city: '南昌市',
    status: 'contacting', createdAt: '2026-03-05', updatedAt: '2026-03-21',
    nextAction: '本周五上门汇报方案，重点演示警务AI大模型与大数据融合应用Demo',
    budget: 1800, department: '南昌市公安局',
    contact: '张伟国', contactRole: '副局长（分管信息化）',
    tags: ['公共安全', '高管引荐', '华东区', '高优先级'], deadline: '2026-05-10',
  },
  {
    id: 'L015', title: '天津市滨海新区数字城管运营中心建设',
    type: 'renewal', typeName: '二次商机', typeColor: 'purple', score: 76,
    scoreReason: '滨海新区城管平台一期（我司承建，2023年交付）即将到期；甲方对平台整体满意，有明确的系统升级意愿，赢率预计>85%。',
    summary: '天津市滨海新区城市管理委员会一期数字城管平台三年运维合同2026年6月到期，区城管委主任已在季度工作会上提出启动二期智能化升级方案研讨。',
    source: '内部CRM老客户维保到期预警', region: '天津市', city: '天津市',
    status: 'contacting', createdAt: '2026-03-03', updatedAt: '2026-03-19',
    nextAction: '本月内提交《二期智能化升级方案建议书》，附上AI辅助监督新功能演示',
    budget: 650, department: '天津市滨海新区城市管理委员会',
    contact: '许明刚', contactRole: '城管委主任',
    tags: ['老客户续签', '城市管理', '华北区'], deadline: '2026-05-30',
  },
]

// ============================================================
// 模拟数据 · 政策库
// ============================================================
const policies = [
  {
    id: 'P001', title: '国家数据局《数字中国建设2026年工作要点》',
    level: 'national', region: '全国', publishedAt: '2026-03-01',
    summary: '明确2026年推进政务数据跨层级共享、建立全国一体化数据基础设施体系、推进政务AI大模型试点等12项重点任务。',
    relevantTasks: ['推进各省市统一大数据底座建设', '部署政务AI大模型能力平台', '完善数据要素市场化交易体系'],
    potentialDepts: ['各省市大数据局', '各省市数字化转型主管部门'],
    budgetSignal: '各省市配套专项资金落地是关键跟进节点',
    score: 90,
  },
  {
    id: 'P002', title: '广东省《数字政府建设三年行动方案（2025-2027）》',
    level: 'provincial', region: '广东省', publishedAt: '2025-11-15',
    summary: '明确三年内建设全省统一政务云底座、政务数据湖、AI大模型服务平台，赋能省市县三级政务系统，重点推进珠三角城市群数字化协同。',
    relevantTasks: ['建设省级政务数据湖', '市级数字政府标准化建设试点', '政务AI应用场景落地'],
    potentialDepts: ['广东省政务服务数据管理局', '各市大数据局'],
    budgetSignal: '广东省财政2026年数字政府专项预算已公示：12亿元',
    score: 95,
  },
  {
    id: 'P003', title: '上海市《城市数字化转型"十四五"规划中期评估》',
    level: 'provincial', region: '上海市', publishedAt: '2026-02-10',
    summary: '评估显示数字底座建设推进良好，但AI大模型政务应用落地率不及预期，中期评估报告明确提出2026年需重点补强政务大模型能力建设。',
    relevantTasks: ['补强政务大模型能力', '推进城市感知网络AI升级', '完成16个区数据共享专项'],
    potentialDepts: ['上海市大数据中心', '各区大数据管理部门'],
    budgetSignal: '市级补充专项预算预计2026年Q2公示',
    score: 82,
  },
  {
    id: 'P004', title: '成都市《数字政府2.0三年行动方案（2026-2028）》',
    level: 'city', region: '四川省', publishedAt: '2026-03-05',
    summary: '明确逐步建立覆盖全市政务部门的政务AI大模型能力底座，同步推进数据要素市场化试点，预计2026年完成规划与方案设计阶段。',
    relevantTasks: ['部署政务AI大模型底座', '建设数据要素流通试验区', '扩大政务数据共享覆盖范围'],
    potentialDepts: ['成都市大数据局', '成都市发展改革委'],
    budgetSignal: '专项债申报中，预计2026年Q3资金到位',
    score: 78,
  },
  {
    id: 'P005', title: '浙江省《关于加快推进数字政府迭代升级的若干措施》',
    level: 'provincial', region: '浙江省', publishedAt: '2026-01-20',
    summary: '出台16条措施加速政府数字化，重点推进AI赋能政务服务、打通省市县三级数据壁垒、建立数据资产管理体系',
    relevantTasks: ['AI赋能政务服务升级改造', '县级数字政府标准化建设', '建立全省统一数据资产管理平台'],
    potentialDepts: ['浙江省大数据发展管理局', '各地市数字化改革办公室'],
    budgetSignal: '省级预算已公示，各市配套资金预计Q2落地',
    score: 88,
  },
]

// ============================================================
// 模拟数据 · 招采/标讯库
// ============================================================
const bids = [
  {
    id: 'B001', title: '广州市政务数据局大数据治理平台建设项目（采购意向公示）',
    amount: 800, region: '广东省', city: '广州市',
    status: 'intention', publishedAt: '2026-03-21', deadline: '2026-04-05',
    department: '广州市政务数据局', source: '广东省政府采购网',
    description: '建设覆盖全市47个委办局的统一大数据治理平台，包含数据目录、数据质量、数据安全三大功能模块。',
    hasSubcontract: false, competitors: [], winner: null,
    policyRef: 'P002',
  },
  {
    id: 'B002', title: '上海市静安区数据共享交换平台（废标重招）',
    amount: 900, region: '上海市', city: '上海市',
    status: 'bidding', publishedAt: '2026-03-12', deadline: '2026-04-10',
    department: '上海市静安区大数据中心', source: '上海市政府采购云平台',
    description: '第一次采购因技术分歧废标。本次重新发布，预算调增100万，技术要求补充了大模型接入能力。',
    hasSubcontract: false, competitors: ['中软国际', '神州信息'],
    winner: null, policyRef: 'P003',
  },
  {
    id: 'B003', title: '重庆市渝北区智慧城市工程EPC总包（华为中标）',
    amount: 35000, region: '重庆市', city: '重庆市',
    status: 'awarded', publishedAt: '2026-03-01', deadline: null,
    department: '重庆市渝北区智慧城市建设指挥部', source: '重庆市公共资源交易平台',
    description: '智慧城市EPC总包，华为中标，标书中含大数据治理子模块（约1500万）。',
    hasSubcontract: true, competitors: [], winner: '华为技术有限公司',
    subcontractNote: '大数据治理模块（约1500万）将对外分包，是我司借船出海的切入点',
    policyRef: null,
  },
  {
    id: 'B004', title: '福建省政务AI大模型能力底座集中采购',
    amount: 3200, region: '福建省', city: '福州市',
    status: 'bidding', publishedAt: '2026-03-14', deadline: '2026-04-20',
    department: '福建省大数据管理局', source: '福建省政府采购网',
    description: '省级统一集采政务专用AI大模型底座，要求支持本地化私有化部署，面向全省40个省直部门提供服务。',
    hasSubcontract: false, competitors: ['华为云', '百度智能云'],
    winner: null, policyRef: null,
  },
  {
    id: 'B005', title: '北京市丰台区数字政务服务平台升级改造',
    amount: 1100, region: '北京市', city: '北京市',
    status: 'bidding', publishedAt: '2026-03-10', deadline: '2026-03-28',
    department: '北京市丰台区政务服务局', source: '北京市政府采购网',
    description: '对现有政务服务平台进行AI化智能升级，新增智能审批、AI客服、数据看板等功能。',
    hasSubcontract: false, competitors: ['中软国际', '思特奇'],
    winner: null, policyRef: null,
  },
  {
    id: 'B006', title: '辽宁省营口市公安局警务大数据平台',
    amount: 2400, region: '辽宁省', city: '营口市',
    status: 'failed', publishedAt: '2026-02-20', deadline: null,
    department: '营口市公安局', source: '辽宁省公共资源交易中心',
    description: '因预算调整原因发布废标公告，预计3月底重新发布更新后的采购需求。',
    hasSubcontract: false, competitors: ['中国电科', '海康威视'],
    winner: null, policyRef: null,
  },
]

// ============================================================
// 模拟数据 · 竞品情报库
// ============================================================
const competitors = [
  {
    id: 'C001', name: '华为技术有限公司（政务云业务）', shortName: '华为云',
    type: '整合型', strength: ['政府关系强', '硬件生态完整', '品牌背书强'],
    weakness: ['软件弹性不足', '定制化能力弱', '价格高昂'],
    recentWins: [
      { project: '重庆市渝北区智慧城市EPC', amount: 35000, date: '2026-03', region: '重庆' },
      { project: '广东省统一政务云底座', amount: 28000, date: '2026-01', region: '广东' },
    ],
    ecosystemPartners: ['新华三', '中软国际', '软通动力'],
    coverageRegions: ['广东', '重庆', '四川', '北京'],
  },
  {
    id: 'C002', name: '中软国际科技集团', shortName: '中软国际',
    type: '软件集成型', strength: ['华为生态深度绑定', '人力资源成本低', '承接能力强'],
    weakness: ['自研能力弱', '产品化程度低', '过度依赖华为'],
    recentWins: [
      { project: '北京市政务数据共享交换平台', amount: 1800, date: '2026-02', region: '北京' },
      { project: '河南省大数据中心扩容', amount: 3200, date: '2025-11', region: '河南' },
    ],
    ecosystemPartners: ['华为云', '毕马威', '安永'],
    coverageRegions: ['北京', '河南', '广东', '上海'],
  },
  {
    id: 'C003', name: '浪潮软件集团', shortName: '浪潮',
    type: '平台型', strength: ['山东根据地牢固', '政务领域老牌玩家', '本地化服务好'],
    weakness: ['AI能力相对滞后', '产品迭代慢'],
    recentWins: [
      { project: '山东省电子政务云平台扩容', amount: 8500, date: '2026-03', region: '山东' },
    ],
    ecosystemPartners: ['IBM', '甲骨文'],
    coverageRegions: ['山东', '江苏', '北京'],
  },
]

// ============================================================
// 模拟数据 · 政企图谱（存量/潜在客户）
// ============================================================
const customers = [
  {
    id: 'CU001', name: '广州市政务服务数据管理局', abbr: '广州政数局',
    region: '广东省', city: '广州市', type: '省会城市核心局',
    projects: [
      { name: '广州市政务数据共享交换平台一期', year: 2023, value: 680, status: '交付完成', ourRole: '总包' },
    ],
    totalContractValue: 680, lastContact: '2026-03-18',
    renewal: { risk: 'low', opportunityTitle: '二期AI大模型升级', estimatedValue: 1500, estimatedDate: '2026-Q3' },
    keyContacts: [{ name: '王建国', role: '采购处处长', relation: '良好' }],
    itSuppliers: ['我司', '华为云（基础设施）', '中软国际（实施服务）'],
  },
  {
    id: 'CU002', name: '深圳市南山区政务服务数据管理局', abbr: '南山政数局',
    region: '广东省', city: '深圳市', type: '区级直辖',
    projects: [
      { name: '南山区政务云平台建设项目', year: 2023, value: 950, status: '运维期', ourRole: '总包' },
    ],
    totalContractValue: 950, lastContact: '2026-03-19',
    renewal: { risk: 'low', opportunityTitle: '二期AI+数据要素升级', estimatedValue: 1200, estimatedDate: '2026-Q2' },
    keyContacts: [{ name: '陈志强', role: '副局长', relation: '深度合作' }],
    itSuppliers: ['我司', '腾讯云（基础设施）'],
  },
  {
    id: 'CU003', name: '杭州市西湖区大数据局', abbr: '西湖区大数据局',
    region: '浙江省', city: '杭州市', type: '区级',
    projects: [
      { name: '西湖区政务数字底座建设', year: 2022, value: 420, status: '交付完成', ourRole: '数据底座分包' },
    ],
    totalContractValue: 420, lastContact: '2025-12-15',
    renewal: { risk: 'medium', opportunityTitle: '人事异动衍生：拱墅区新建项目', estimatedValue: null, estimatedDate: null },
    keyContacts: [{ name: '刘勇', role: '原局长（已调任）', relation: '核心KP' }],
    itSuppliers: ['我司（分包）', '海康威视（主包）'],
  },
  {
    id: 'CU004', name: '天津市滨海新区城市管理委员会', abbr: '滨海城管委',
    region: '天津市', city: '天津市', type: '区级',
    projects: [
      { name: '滨海新区数字城管平台一期', year: 2023, value: 380, status: '维保到期（2026-06）', ourRole: '总包' },
    ],
    totalContractValue: 380, lastContact: '2026-03-19',
    renewal: { risk: 'low', opportunityTitle: '二期智能化改造（维保续签+升级）', estimatedValue: 650, estimatedDate: '2026-Q2' },
    keyContacts: [{ name: '许明刚', role: '城管委主任', relation: '良好' }],
    itSuppliers: ['我司', '科大讯飞（AI语音模块）'],
  },
]

// ============================================================
// 模拟数据 · 营销日历（展会/活动）
// ============================================================
const events = [
  {
    id: 'E001', name: '2026中国数字政府大会', type: 'conference',
    location: '北京国家会议中心', startDate: '2026-03-25', endDate: '2026-03-26',
    organizer: '工业和信息化部', relevance: 'high',
    description: '国内最高规格数字政府年度盛会，各省市大数据局长出席，是建立高层人脉的核心场景。',
    registered: true, expectedAttendees: '全国各省市大数据局长、信息化主管领导',
    leads: [],
  },
  {
    id: 'E002', name: '2026粤港澳大湾区数字经济峰会', type: 'summit',
    location: '广州琶洲会展中心', startDate: '2026-04-10', endDate: '2026-04-11',
    organizer: '广东省政务服务数据管理局', relevance: 'high',
    description: '聚焦大湾区数字政府建设与数据要素市场化，广东省及各市局长出席，是华南区重要客户关系维护场合。',
    registered: true, expectedAttendees: '广东省、深广佛等各市大数据局领导',
    leads: ['L001'],
  },
  {
    id: 'E003', name: '2026智慧城市与大数据技术博览会（上海）', type: 'expo',
    location: '上海世博展览馆', startDate: '2026-04-20', endDate: '2026-04-22',
    organizer: '中国智慧城市产业联盟', relevance: 'medium',
    description: '以展览为主，可接触华东区潜在客户，适合展示新产品方案。',
    registered: false, expectedAttendees: '华东区政府采购负责人、IT集成商',
    leads: [],
  },
  {
    id: 'E004', name: '全国大数据产业发展大会（贵阳）', type: 'conference',
    location: '贵阳国际会议中心', startDate: '2026-05-15', endDate: '2026-05-16',
    organizer: '国家数据局', relevance: 'medium',
    description: '国家数据局主办，重点展示数据要素市场化成果，可跟进多省市的数据要素平台建设需求。',
    registered: false, expectedAttendees: '全国数据要素相关主管部门',
    leads: [],
  },
]

// ============================================================
// 模拟数据 · 每日线索简报
// ============================================================
const generateBriefing = (date, leads_) => ({
  id: `BR-${date.replace(/-/g, '')}`,
  date,
  title: `《智鹰ToG商机日报》${date}`,
  stats: { total: leads_.length, high: leads_.filter(l => l.score >= 80).length, medium: leads_.filter(l => l.score >= 60 && l.score < 80).length },
  highlights: leads_.slice(0, 3).map(l => ({ id: l.id, title: l.title, score: l.score, type: l.typeName, nextAction: l.nextAction })),
  sentChannels: ['飞书', '企业微信'],
  conversionStats: { pushed: leads_.length, claimed: Math.ceil(leads_.length * 0.7), converted: Math.ceil(leads_.length * 0.3) },
})

const briefings = [
  generateBriefing('2026-03-21', leads.slice(0, 5)),
  generateBriefing('2026-03-20', leads.slice(2, 7)),
  generateBriefing('2026-03-19', leads.slice(4, 9)),
  generateBriefing('2026-03-18', leads.slice(6, 10)),
  generateBriefing('2026-03-17', leads.slice(8, 12)),
  generateBriefing('2026-03-14', leads.slice(10, 13)),
  generateBriefing('2026-03-13', leads.slice(11, 14)),
]

// ============================================================
// API 路由
// ============================================================
// 健康检查
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: '智鹰API服务运行正常', timestamp: new Date().toISOString() }))

// 工作台统计
app.get('/api/dashboard/stats', (req, res) => {
  res.json({
    totalLeads: leads.length,
    highPriority: leads.filter(l => l.score >= 80).length,
    contacting: leads.filter(l => l.status === 'contacting').length,
    filed: leads.filter(l => l.status === 'filed').length,
    funnel: [
      { name: '线索池', value: leads.length },
      { name: '接触中', value: leads.filter(l => l.status === 'contacting').length },
      { name: '已立项', value: leads.filter(l => l.status === 'filed').length },
      { name: '招投标', value: bids.filter(b => b.status === 'bidding').length },
    ],
    todayLeads: leads.filter(l => l.createdAt === '2026-03-21').length,
    renewalAlert: customers.filter(c => c.renewal.risk === 'low').length,
  })
})

// 工作台待办
app.get('/api/dashboard/todos', (req, res) => {
  res.json([
    { id: 1, type: 'urgent', text: '广州市政务数据局采购意向已公示，招标窗口期仅剩2周，请立即安排接触', leadId: 'L001', date: '2026-03-21' },
    { id: 2, type: 'reminder', text: '南山区二期升级方案建议书需本周五前提交', leadId: 'L003', date: '2026-03-22' },
    { id: 3, type: 'renewal', text: '天津滨海新区城管委维保合同6月到期，请加速推进续签谈判', leadId: 'L015', date: '2026-03-25' },
    { id: 4, type: 'visit', text: '福建省大数据局技术交流会（下周三），需提前准备大模型Demo', leadId: 'L009', date: '2026-03-26' },
    { id: 5, type: 'event', text: '中国数字政府大会（3月25日）：重点拜访山东省大数据局孙副局长', leadId: 'L005', date: '2026-03-25' },
  ])
})

// 线索列表（支持过滤）
app.get('/api/leads', (req, res) => {
  let result = [...leads]
  const { type, status, minScore, region, keyword } = req.query
  if (type) result = result.filter(l => l.type === type)
  if (status) result = result.filter(l => l.status === status)
  if (minScore) result = result.filter(l => l.score >= Number(minScore))
  if (region) result = result.filter(l => l.region.includes(region))
  if (keyword) result = result.filter(l => l.title.includes(keyword) || l.summary.includes(keyword))
  result.sort((a, b) => b.score - a.score)
  res.json({ data: result, total: result.length })
})

// 线索详情
app.get('/api/leads/:id', (req, res) => {
  const lead = leads.find(l => l.id === req.params.id)
  if (!lead) return res.status(404).json({ error: '线索不存在' })
  // 关联政策（如果有）
  const relatedPolicy = lead.policyRef ? policies.find(p => p.id === lead.policyRef) : null
  res.json({ ...lead, relatedPolicy })
})

// 更新线索状态
app.patch('/api/leads/:id/status', (req, res) => {
  const lead = leads.find(l => l.id === req.params.id)
  if (!lead) return res.status(404).json({ error: '线索不存在' })
  lead.status = req.body.status
  lead.updatedAt = new Date().toISOString().split('T')[0]
  res.json({ success: true, lead })
})

// 政策列表
app.get('/api/policies', (req, res) => {
  const { level, region, keyword } = req.query
  let result = [...policies]
  if (level) result = result.filter(p => p.level === level)
  if (region) result = result.filter(p => p.region.includes(region))
  if (keyword) result = result.filter(p => p.title.includes(keyword) || p.summary.includes(keyword))
  res.json({ data: result, total: result.length })
})

// 招采列表（静态 + 实时抓取数据合并）
app.get('/api/bids', (req, res) => {
  const { status, region, source } = req.query
  // source=realtime 只返回实时抓取数据；source=static 只返回静态数据
  let result
  if (source === 'realtime') result = [...ccgpBids]
  else if (source === 'static') result = [...bids]
  else result = [...bids, ...ccgpBids]
  if (status) result = result.filter(b => b.status === status)
  if (region) result = result.filter(b => b.region && b.region.includes(region))
  // 按发布时间降序
  result.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
  res.json({ data: result, total: result.length, realtimeCount: ccgpBids.length })
})

// 爬虫状态查询
app.get('/api/crawler/status', (req, res) => {
  res.json({
    ...crawlerStatus,
    ccgpBidsCount: ccgpBids.length,
    keywords: require('./scrapers/ccgp').FILTER_KEYWORDS,
    nextRun: '每30分钟自动执行一次',
  })
})

// 手动触发爬虫（用于调试或立即刷新）
app.post('/api/crawler/run', async (req, res) => {
  if (crawlerStatus.running) {
    return res.status(409).json({ message: '爬虫正在运行中，请稍后再试' })
  }
  res.json({ message: '爬虫任务已触发，请通过 /api/crawler/status 查看进度' })
  runCrawler()
})

// 竞品情报
app.get('/api/competitors', (req, res) => res.json({ data: competitors }))

// 政企图谱 - 客户列表
app.get('/api/graph/customers', (req, res) => res.json({ data: customers }))

// 营销活动日历
app.get('/api/events', (req, res) => res.json({ data: events }))

// 每日简报列表
app.get('/api/briefings', (req, res) => res.json({ data: briefings }))

// 今日简报
app.get('/api/briefings/today', (req, res) => res.json(briefings[0]))

// ============================================================
// 启动服务
// ============================================================
const PORT = 3001
app.listen(PORT, () => {
  console.log(`\n🦅 智鹰后端API服务启动成功`)
  console.log(`   地址: http://localhost:${PORT}`)
  console.log(`   健康检查: http://localhost:${PORT}/api/health\n`)
})
