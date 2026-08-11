// Tailwind는 CSS 진입점마다 @config 로 자기 과목 설정을 가리킨다 → src/styles/*.css
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default { plugins: [tailwindcss(), autoprefixer()] };
