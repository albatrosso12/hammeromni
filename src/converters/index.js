import { VMFParser, generateVMF } from './VMFParser.js';
import { BSPWriter, createBSPFromVMF } from './BSPWriter.js';

export function exportToVMF(objects, entities = []) {
  const vmfContent = generateVMF(objects, entities);
  
  const blob = new Blob([vmfContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'map.vmf';
  a.click();
  
  URL.revokeObjectURL(url);
  console.log('Экспортировано в VMF');
  
  return vmfContent;
}

export function compileVMFtoBSP(vmfContent, options = {}) {
  const parser = new VMFParser();
  parser.parse(vmfContent);
  
  const vmfData = {
    world: parser.world,
    entities: parser.entities
  };
  
  console.log(`[Compiler] VMF парсинг завершён: ${vmfData.world?.brushes?.length || 0} брашей, ${vmfData.entities?.length || 0} сущностей`);
  
  const bspBuffer = createBSPFromVMF(vmfData, options);
  
  console.log('[Compiler] BSP генерация завершена');
  
  return bspBuffer;
}

export function initConverter() {
  window.exportToVMF = exportToVMF;
  window.compileVMFtoBSP = compileVMFtoBSP;
  console.log('[Compiler] Конвертер инициализирован');
}