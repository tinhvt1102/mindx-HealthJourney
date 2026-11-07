import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Xuất phần tử DOM của Báo cáo y tế sang file PDF chuẩn khổ A4 (210mm x 297mm)
 * Xử lý tương thích 100% với Tailwind CSS v4 (triệt tiêu lỗi oklch color parser của html2canvas)
 *
 * @param {HTMLElement|string} elementOrId - Phần tử DOM hoặc ID của phần tử
 * @param {string} [fileName] - Tên file xuất ra
 * @returns {Promise<boolean>}
 */
export async function exportMedicalReportToPdf(elementOrId, fileName) {
  const element = typeof elementOrId === 'string'
    ? document.getElementById(elementOrId)
    : elementOrId;

  if (!element) {
    throw new Error('Không tìm thấy phần tử DOM để xuất PDF');
  }

  // Chụp phần tử DOM với scale: 2 để chữ, số và đường kẻ nét căng, không bị vỡ hạt
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: (clonedDoc, clonedElement) => {
      // 1. Xóa adoptedStyleSheets nếu có (Tailwind v4 inject constructable stylesheets chứa oklch)
      try {
        if (clonedDoc.adoptedStyleSheets && clonedDoc.adoptedStyleSheets.length > 0) {
          clonedDoc.adoptedStyleSheets = [];
        }
      } catch {
        // ignore
      }

      // 2. Khử triệt để lỗi "unsupported color function oklch" của Tailwind v4:
      // Quét tất cả thẻ <style> và thay thế mọi hàm oklch(...) thành mã màu HEX an toàn
      const styleElements = clonedDoc.querySelectorAll('style');
      styleElements.forEach((styleTag) => {
        if (styleTag.textContent && styleTag.textContent.includes('oklch')) {
          styleTag.textContent = styleTag.textContent.replace(/oklch\([^)]+\)/gi, '#64748b');
        }
      });

      // 3. Gỡ bỏ các thẻ link stylesheet ngoài nếu có
      const linkElements = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
      linkElements.forEach((linkTag) => {
        try {
          linkTag.remove();
        } catch {
          // ignore
        }
      });

      // 4. Ép style chuẩn (hex) cho toàn bộ các phần tử trong template
      if (clonedElement) {
        clonedElement.style.color = '#1e293b';
        clonedElement.style.backgroundColor = '#ffffff';

        const allNodes = clonedElement.querySelectorAll('*');
        allNodes.forEach((node) => {
          if (node.style) {
            for (let i = 0; i < node.style.length; i++) {
              const prop = node.style[i];
              const val = node.style.getPropertyValue(prop);
              if (val && val.includes('oklch')) {
                node.style.setProperty(prop, '#64748b');
              }
            }
          }
        });
      }
    },
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210; // mm
  const pageHeight = 297; // mm

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Nếu chiều cao vừa khít 1 trang A4
  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  } else {
    // Nếu vượt quá 1 trang, xử lý phân trang liền mạch
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
  }

  const finalFileName = fileName || `Bao-cao-suc-khoe-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(finalFileName);
  return true;
}

/**
 * Tạo tên file PDF chuẩn theo format: Bao-cao-suc-khoe-[TenUser]-[Ngay].pdf
 * @param {string} [userName] 
 * @returns {string}
 */
export function generateMedicalReportFileName(userName) {
  const cleanName = (userName || 'NguoiDung')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_');
  const today = new Date().toISOString().slice(0, 10);
  return `Bao-cao-suc-khoe-${cleanName}-${today}.pdf`;
}
