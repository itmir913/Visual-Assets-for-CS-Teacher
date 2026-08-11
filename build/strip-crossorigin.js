// Vite는 서브리소스에 crossorigin을 붙인다. 원본에 없던 속성을 굳이 남기지 않는다.
export default function stripCrossorigin() {
    return {
        name: 'strip-crossorigin',
        transformIndexHtml: {
            order: 'post',
            handler: (html) => html.replace(/\s+crossorigin(?==|(?=[\s>]))/g, ''),
        },
    };
}
