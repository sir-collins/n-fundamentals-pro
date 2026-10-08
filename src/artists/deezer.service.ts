import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArtistProfile } from './dto/artist-profile.type';

/** How long one Deezer call may take before we give up on it. */
export const DEEZER_TIMEOUT_MS = 3000;

/** The parts of Deezer's `/search/artist` response this app reads. */
interface DeezerArtist {
  id: number;
  name: string;
  link: string;
  picture_medium: string;
  nb_album: number;
  nb_fan: number;
}

interface DeezerSearchResponse {
  data?: DeezerArtist[];
  // Deezer reports API errors with HTTP 200 and this body, not a 4xx/5xx.
  error?: { type: string; message: string };
}

/**
 * Thin client for Deezer's public API (no key needed), behind
 * `Artist.profile`. Injectable so tests can swap it out with
 * `overrideProvider` instead of reaching the real internet.
 */
@Injectable()
export class DeezerService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Looks `name` up on Deezer.
   * @returns the first result whose name matches exactly (ignoring case),
   *   or `null` if Deezer has no such artist — a search always returns
   *   *someone*, and a stranger's profile is worse than none.
   * @throws GatewayTimeoutException if Deezer takes longer than
   *   `DEEZER_TIMEOUT_MS`.
   * @throws BadGatewayException if Deezer is unreachable or answers with
   *   an error (HTTP or in-body).
   */
  async findArtistProfile(name: string): Promise<ArtistProfile | null> {
    const baseUrl = this.configService.getOrThrow<string>('DEEZER_API_URL');
    const url = `${baseUrl}/search/artist?q=${encodeURIComponent(name)}&limit=5`;

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(DEEZER_TIMEOUT_MS),
      });
    } catch (error) {
      // Checked by `name`, not `instanceof Error`: the timeout is a
      // `DOMException`, and `instanceof` fails when it comes from another
      // JS realm (as under Jest), which would misreport it as unreachable.
      if ((error as { name?: unknown } | null)?.name === 'TimeoutError') {
        throw new GatewayTimeoutException('Deezer did not respond in time');
      }
      throw new BadGatewayException('Deezer could not be reached');
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Deezer request failed (HTTP ${response.status})`,
      );
    }

    const body = (await response.json()) as DeezerSearchResponse;

    if (body.error) {
      throw new BadGatewayException(`Deezer error: ${body.error.type}`);
    }

    const wanted = name.toLowerCase();
    const match = body.data?.find(
      (artist) => artist.name.toLowerCase() === wanted,
    );

    return match
      ? {
          deezerId: match.id,
          link: match.link,
          pictureUrl: match.picture_medium,
          fans: match.nb_fan,
          albums: match.nb_album,
        }
      : null;
  }
}
