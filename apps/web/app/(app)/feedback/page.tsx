import { Mail, Phone, Send } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const metadata = {
  title: "انتقادها و پیشنهادها | طرحینو",
}

export default function FeedbackPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:gap-6">
      <div>
        <h1 className="text-lg">انتقادها و پیشنهادها</h1>
        <p className="text-sm text-muted-foreground">
          نظر شما طرحینو را بهتر می‌کند. هرچه دقیق‌تر بنویسید، سریع‌تر بررسی و
          اصلاح می‌شود.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>چه چیزی بنویسید؟</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div className="flex flex-col gap-1.5">
            <p className="font-medium">اگر چیزی خراب است (گزارش مشکل)</p>
            <ul className="list-disc space-y-1 pr-5 text-muted-foreground">
              <li>کجا اتفاق افتاد؟ (مثلاً صفحه «امروز» یا «تنظیمات»)</li>
              <li>چه کاری کردید؟ قدم‌به‌قدم بنویسید.</li>
              <li>انتظار داشتید چه شود و در عوض چه شد؟</li>
              <li>
                با چه دستگاه و مرورگری بودید؟ (مثلاً گوشی اندروید با کروم)
              </li>
              <li>اگر می‌شود، اسکرین‌شات بفرستید.</li>
            </ul>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="font-medium">اگر ایده‌ای دارید (پیشنهاد)</p>
            <ul className="list-disc space-y-1 pr-5 text-muted-foreground">
              <li>چه مشکلی را حل می‌کند؟ الان چطور انجامش می‌دهید؟</li>
              <li>پیشنهاد شما دقیقاً چیست؟</li>
              <li>یک مثال واقعی از کلاس خودتان بزنید.</li>
            </ul>
          </div>
          <div className="rounded-lg bg-muted p-3 text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">نمونه پیام خوب</p>
            <p>
              «در صفحه هفته، وقتی روی درس روز چهارشنبه می‌زنم، پنجره ویرایش باز
              نمی‌شود. انتظار دارم مثل روزهای دیگر باز شود. گوشی سامسونگ با کروم
              است. اسکرین‌شات را هم فرستادم.»
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>از چه راهی بفرستید؟</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            یکی از راه‌های زیر را انتخاب کنید؛ پیامتان را با همان الگوی بالا
            بفرستید:
          </p>
          <ul className="flex flex-col gap-2">
            <li className="flex items-center gap-2">
              <Send className="size-4 shrink-0 text-muted-foreground" />
              <span>بله:</span>
              <a
                href="https://ble.ir/Amir83Nasr"
                target="_blank"
                rel="noreferrer"
                dir="ltr"
                className="text-primary underline underline-offset-4"
              >
                Amir83Nasr
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-muted-foreground" />
              <span>تلفن:</span>
              <a href="tel:+989306853363" className="text-primary">
                ۰۹۳۰۶۸۵۳۳۶۳
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <span>ایمیل:</span>
              <a
                href="mailto:amirhossein.nasrollahi.main@gmail.com?subject=%D8%A7%D9%86%D8%AA%D9%82%D8%A7%D8%AF%20%DB%8C%D8%A7%20%D9%BE%DB%8C%D8%B4%D9%86%D9%87%D8%A7%D8%AF%20%D8%A8%D8%B1%D8%A7%DB%8C%20%D8%B7%D8%B1%D8%AD%DB%8C%D9%86%D9%88"
                dir="ltr"
                className="text-primary underline underline-offset-4"
              >
                amirhossein.nasrollahi.main@gmail.com
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
