import {redirect} from 'next/navigation';

export default function Home() {
    // 自动重定向到登录页
    redirect('/auth/login');
}
