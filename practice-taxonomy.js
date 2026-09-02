(() => {
  const bank = window.PRACTICE_BANK;
  if (!bank?.questions || !bank?.courses) return;

  // 408 目录是“408 → 四门课程 → 知识点 → 题目”。
  // 题目 ID 不参与目录重组，因此已有做题记录和笔记不会受影响。
  const taxonomy = {
    '数据结构': ['复杂度基础', '线性结构', '树', '图', '查找', '排序', '常见算法思想'],
    '操作系统': ['OS基础', '进程与线程', 'CPU调度', '同步与互斥', '死锁', '内存管理', '虚拟内存', '文件与I/O'],
    '计算机网络': ['网络体系结构', '数据链路层', 'IP与子网', '路由基础', 'TCP/UDP', 'TCP可靠传输', '应用层'],
    '计算机组成原理': ['数据表示', 'CPU基础', '指令系统', '流水线', '存储系统', 'Cache', '主存与地址', 'I/O', '磁盘与外存'],
  };

  const placement = {
    // 数据结构
    '408-u6570-636e-7ed3-6784-1': ['数据结构', '树'],
    '408-u6570-636e-7ed3-6784-2': ['数据结构', '树'],
    '408-u6570-636e-7ed3-6784-3': ['数据结构', '树'],
    '408-u6570-636e-7ed3-6784-4': ['数据结构', '树'],
    '408-u6570-636e-7ed3-6784-5': ['数据结构', '树'],
    '408-u6570-636e-7ed3-6784-6': ['数据结构', '树'],
    '408-u6570-636e-7ed3-6784-7': ['数据结构', '查找'],
    '408-u6570-636e-7ed3-6784-8': ['数据结构', '排序'],
    '408-u6570-636e-7ed3-6784-9': ['数据结构', '排序'],
    '408-u6570-636e-7ed3-6784-10': ['数据结构', '排序'],
    '408-u6570-636e-7ed3-6784-11': ['数据结构', '查找'],
    '408-u6570-636e-7ed3-6784-12': ['数据结构', '查找'],
    '408-u6570-636e-7ed3-6784-13': ['数据结构', '常见算法思想'],
    '408-u6570-636e-7ed3-6784-14': ['数据结构', '树'],
    '408-u6570-636e-7ed3-6784-15': ['数据结构', '树'],
    // 操作系统
    '408-u64cd-4f5c-7cfb-7edf-1': ['操作系统', '内存管理'],
    '408-u64cd-4f5c-7cfb-7edf-2': ['操作系统', '虚拟内存'],
    '408-u64cd-4f5c-7cfb-7edf-3': ['操作系统', '虚拟内存'],
    '408-u64cd-4f5c-7cfb-7edf-4': ['操作系统', '内存管理'],
    '408-u64cd-4f5c-7cfb-7edf-5': ['操作系统', '虚拟内存'],
    '408-u64cd-4f5c-7cfb-7edf-6': ['操作系统', '内存管理'],
    '408-u64cd-4f5c-7cfb-7edf-7': ['操作系统', '死锁'],
    '408-u64cd-4f5c-7cfb-7edf-8': ['操作系统', '同步与互斥'],
    '408-u64cd-4f5c-7cfb-7edf-9': ['操作系统', '进程与线程'],
    '408-u64cd-4f5c-7cfb-7edf-10': ['操作系统', '虚拟内存'],
    // 计算机网络
    '408-u8ba1-7b97-673a-7f51-7edc-1': ['计算机网络', 'TCP/UDP'],
    '408-u8ba1-7b97-673a-7f51-7edc-2': ['计算机网络', 'IP与子网'],
    '408-u8ba1-7b97-673a-7f51-7edc-3': ['计算机网络', 'IP与子网'],
    '408-u8ba1-7b97-673a-7f51-7edc-4': ['计算机网络', '数据链路层'],
    '408-u8ba1-7b97-673a-7f51-7edc-5': ['计算机网络', 'TCP可靠传输'],
    '408-u8ba1-7b97-673a-7f51-7edc-6': ['计算机网络', 'TCP/UDP'],
    '408-u8ba1-7b97-673a-7f51-7edc-7': ['计算机网络', 'TCP/UDP'],
    '408-u8ba1-7b97-673a-7f51-7edc-8': ['计算机网络', 'IP与子网'],
    '408-u8ba1-7b97-673a-7f51-7edc-9': ['计算机网络', 'IP与子网'],
    '408-u8ba1-7b97-673a-7f51-7edc-10': ['计算机网络', '应用层'],
    // 计算机组成原理
    '408-u8ba1-7b97-673a-7ec4-6210-539f-7406-1': ['计算机组成原理', '磁盘与外存'],
    '408-u8ba1-7b97-673a-7ec4-6210-539f-7406-3': ['计算机组成原理', '存储系统'],
    '408-u8ba1-7b97-673a-7ec4-6210-539f-7406-4': ['计算机组成原理', '数据表示'],
    '408-u8ba1-7b97-673a-7ec4-6210-539f-7406-5': ['计算机组成原理', '数据表示'],
  };

  bank.questions.forEach(question => {
    const target = placement[question.id];
    if (target) {
      question.group = target[0];
      question.category = target[1];
    }
    // 这题原本被误放在 408 计组；保留它的 ID，只移到实际所属的 Linux 运维。
    if (question.id === '408-u8ba1-7b97-673a-7ec4-6210-539f-7406-2') {
      question.source = '后端开发';
      question.category = 'Linux运维';
      delete question.group;
    }
  });

  const course408 = bank.courses.find(course => course.key === '408');
  if (course408) {
    // 同一知识点的题号只用于页面导航；按现有题在前、新导入题在后的顺序重新编号。
    Object.entries(taxonomy).forEach(([group, topics]) => topics.forEach(topic => {
      bank.questions
        .filter(question => question.source === '408' && question.group === group && question.category === topic)
        .forEach((question, index) => { question.order = index + 1; question.number = String(index + 1); });
    }));
    course408.groups = Object.entries(taxonomy).map(([name, topics]) => ({
      name,
      count: bank.questions.filter(question => question.source === '408' && question.group === name).length,
      topics: topics.map(topic => ({
        name: topic,
        count: bank.questions.filter(question => question.source === '408' && question.group === name && question.category === topic).length,
      })),
    }));
    course408.categories = course408.groups.map(({ name, count }) => ({ name, count }));
  }

  const backend = bank.courses.find(course => course.name === '后端开发');
  const linux = backend?.categories.find(category => category.name === 'Linux运维');
  if (linux) linux.count = bank.questions.filter(question => question.source === '后端开发' && question.category === 'Linux运维').length;
})();
