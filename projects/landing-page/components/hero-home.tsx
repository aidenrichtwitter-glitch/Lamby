import Image from 'next/image';
import PageIllustration from '@/components/page-illustration';

export default function HeroHome() {
  return (
    <section className="relative bg-gray-950">
      {/* Page illustration */}
      <PageIllustration />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero content */}
        <div className="pb-12 pt-32 md:pb-20 md:pt-40">
          {/* Section header */}
          <div className="mx-auto max-w-3xl pb-12 text-center md:pb-16">
            <h1
              className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl"
              style={{ textShadow: '0 0 10px #00FFFF, 0 0 20px #00FFFF' }}
            >
              Lamby — Code at Light Speed
            </h1>
            <div className="mx-auto max-w-xs sm:max-w-none">
              <p
                className="mt-6 text-xl text-gray-300"
                style={{ textShadow: '0 0 5px #39FF14' }}
              >
                Neon-powered autonomous AI development
              </p>
            </div>

            {/* Hero buttons */}
            <div className="mx-auto mt-8 max-w-xs flex items-center gap-4 sm:max-w-none">
              <a
                href="#"
                className="py-3 px-6 text-sm font-semibold rounded-lg bg-cyan-500 text-black hover:bg-cyan-400"
                style={{ boxShadow: '0 0 10px rgba(0, 255, 255, 0.5)' }}
              >
                Get Started
              </a>
              <a
                href="#"
                className="py-3 px-6 text-sm font-semibold rounded-lg border border-cyan-400 text-cyan-400 hover:bg-cyan-400/10 bg-transparent"
              >
                Learn More
              </a>
            </div>
          </div>

          {/* Hero image */}
          <div className="relative mx-auto max-w-4xl">
            <Image
              className="mx-auto rounded-lg shadow-2xl"
              src="/images/hero-image.png"
              width={1024}
              height={504}
              alt="Hero"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
